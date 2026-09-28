// שולח Web Push על הודעה חדשה, תזכורת או נקודת מפגש. מופעל מטריגר במסד הנתונים (pg_net).
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

type Member = { id: string; name: string; household_id: string; guardian_id: string | null; active: boolean }

const env = (k: string) => Deno.env.get(k) ?? ''
webpush.setVapidDetails('https://elroitouati.github.io/Garda/', env('VAPID_PUBLIC'), env('VAPID_PRIVATE'))
const APP_URL = 'https://elroitouati.github.io/Garda/'

Deno.serve(async (req) => {
  if (req.headers.get('x-garda-secret') !== env('PUSH_SECRET')) return new Response('forbidden', { status: 403 })
  const { kind, id } = await req.json()
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

  // בשבת לא שולחים כלום
  const { data: shabbat } = await sb.rpc('in_shabbat')
  if (shabbat) return new Response('shabbat')

  const { data: members = [] } = await sb.from('members').select('id,name,household_id,guardian_id,active')
  const people = (members as Member[]).filter((m) => m.active && !m.guardian_id)
  const name = (mid: string) => people.find((m) => m.id === mid)?.name ?? ''
  let to: string[] = []
  let payload: Record<string, unknown> = {}

  if (kind === 'message') {
    const { data: m } = await sb.from('messages').select('*').eq('id', id).single()
    if (!m) return new Response('no message')
    const sender = people.find((x) => x.id === m.sender_id)
    to = people.filter((x) => x.id !== m.sender_id && (
      m.audience === 'all' ||
      (m.audience === 'household' && x.household_id === (m.household_id ?? sender?.household_id)) ||
      (m.audience === 'custom' && (m.recipients ?? []).includes(x.id))
    )).map((x) => x.id)
    if (m.reminded_at) {
      const { data: reads = [] } = await sb.from('message_reads').select('member_id,read_at').eq('message_id', id)
      const seen = new Set((reads as { member_id: string; read_at: string }[]).filter((r) => r.read_at >= m.reminded_at).map((r) => r.member_id))
      to = to.filter((x) => !seen.has(x))
    }
    payload = {
      title: `${m.important ? 'חשוב · ' : ''}${sender?.name ?? 'הודעה'}${m.reminded_at ? ' (תזכורת)' : ''}`,
      body: m.body, tag: `msg-${m.id}`, important: m.important, url: APP_URL,
    }
  } else if (kind === 'meeting') {
    const { data: mt } = await sb.from('meetings').select('*').eq('id', id).single()
    if (!mt) return new Response('no meeting')
    const creator = people.find((x) => x.id === mt.created_by)
    to = people.filter((x) => x.id !== mt.created_by && (mt.audience === 'all' || x.household_id === (mt.household_id ?? creator?.household_id))).map((x) => x.id)
    const at = new Date(mt.meet_at).toLocaleTimeString('he-IL', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
    payload = { title: `נקודת מפגש · ${name(mt.created_by)}`, body: `${mt.title} ב-${at}`, tag: `meet-${mt.id}`, important: true, url: APP_URL }
  } else if (kind === 'photos') {
    // תמונות שעלו ולא דווחו; מחכים דקה וחצי שהעלאה של כמה תמונות תסתיים
    const cutoff = new Date(Date.now() - 90_000).toISOString()
    const { data: fresh = [] } = await sb.from('photos').select('id,member_id').eq('notified', false).lt('created_at', cutoff)
    const rows = fresh as { id: string; member_id: string }[]
    if (!rows.length) return new Response('no new photos')
    await sb.from('photos').update({ notified: true }).in('id', rows.map((r) => r.id))
    const byMember = new Map<string, number>()
    for (const r of rows) byMember.set(r.member_id, (byMember.get(r.member_id) ?? 0) + 1)
    let total = 0
    for (const [uploader, n] of byMember) {
      const recipients = people.filter((x) => x.id !== uploader).map((x) => x.id)
      total += await sendTo(recipients, {
        title: 'תמונות חדשות באלבום',
        body: n === 1 ? `תמונה חדשה מ${name(uploader)}` : `${n} תמונות חדשות מ${name(uploader)}`,
        tag: `photos-${uploader}`, important: false, url: APP_URL,
      })
    }
    return new Response(JSON.stringify({ groups: byMember.size, sent: total }))
  } else return new Response('unknown kind', { status: 400 })

  if (!to.length) return new Response('nobody')
  const sent = await sendTo(to, payload)
  return new Response(JSON.stringify({ to: to.length, sent }), { headers: { 'Content-Type': 'application/json' } })

  async function sendTo(ids: string[], pl: Record<string, unknown>) {
  if (!ids.length) return 0
  const { data: subs = [] } = await sb.from('push_subscriptions').select('*').in('member_id', ids)
  let sent = 0
  await Promise.all((subs as { endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(pl), {
        TTL: 6 * 3600, urgency: pl.important ? 'high' : 'normal',
      })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
    }
  }))
  return sent
  }
})
