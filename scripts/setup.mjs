// הקמה ופריסה אוטומטית מקצה לקצה. אפשר להריץ שוב ושוב (לא יוצר כפילויות).
//
// צריך שלושה משתני סביבה:
//   SUPABASE_ACCESS_TOKEN  — supabase.com/dashboard/account/tokens
//   VERCEL_TOKEN           — vercel.com/account/tokens
//   MAPBOX_TOKEN           — הטוקן הציבורי (pk.) מ-account.mapbox.com
// אופציונלי: GARDA_PIN (אחרת נוצר קוד אקראי ומודפס), VERCEL_TEAM_ID
//
// שימוש: npm run setup
import { execSync } from 'node:child_process'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const NAME = 'tuati-garda'
const { SUPABASE_ACCESS_TOKEN: SB, VERCEL_TOKEN: VC, MAPBOX_TOKEN: MB, VERCEL_TEAM_ID: TEAM } = process.env
const missing = Object.entries({ SUPABASE_ACCESS_TOKEN: SB, VERCEL_TOKEN: VC, MAPBOX_TOKEN: MB }).filter(([, v]) => !v).map(([k]) => k)
if (missing.length) { console.error('חסרים משתני סביבה:', missing.join(', ')); process.exit(1) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log('›', ...a)

async function http(base, token, method, path, body, extraHeaders = {}) {
  const r = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && !(body instanceof Buffer) ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
    body: body instanceof Buffer ? body : body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  return { ok: r.ok, status: r.status, json }
}
const sb = (m, p, b) => http('https://api.supabase.com', SB, m, p, b)
const vc = (m, p, b, h) => http('https://api.vercel.com', VC, m, p + (TEAM ? `${p.includes('?') ? '&' : '?'}teamId=${TEAM}` : ''), b, h)
const must = (r, what) => { if (!r.ok) { console.error(`✗ ${what}: ${r.status}`, JSON.stringify(r.json)); process.exit(1) } return r.json }

// ── 1. Supabase ─────────────────────────────────────────────
const projects = must(await sb('GET', '/v1/projects'), 'רשימת פרויקטים ב-Supabase')
let project = projects.find((p) => p.name === NAME)
if (!project) {
  const orgs = must(await sb('GET', '/v1/organizations'), 'ארגונים ב-Supabase')
  if (!orgs.length) { console.error('✗ אין ארגון בחשבון Supabase. צריך להיכנס פעם אחת ל-supabase.com/dashboard.'); process.exit(1) }
  log('יוצר פרויקט Supabase בפרנקפורט…')
  project = must(await sb('POST', '/v1/projects', {
    name: NAME, organization_id: orgs[0].slug ?? orgs[0].id, region: 'eu-central-1',
    db_pass: randomBytes(24).toString('base64url'),
  }), 'יצירת פרויקט Supabase')
}
const ref = project.id ?? project.ref
for (let i = 0; ; i++) {
  const p = must(await sb('GET', `/v1/projects/${ref}`), 'מצב הפרויקט')
  if (p.status === 'ACTIVE_HEALTHY') break
  if (i === 0) log(`ממתין שהפרויקט יעלה (${p.status})…`)
  if (i > 90) { console.error('✗ הפרויקט לא עלה אחרי 15 דקות'); process.exit(1) }
  await sleep(10000)
}
const SUPABASE_URL = `https://${ref}.supabase.co`
const keys = must(await sb('GET', `/v1/projects/${ref}/api-keys?reveal=true`), 'מפתחות API')
const ANON = (keys.find((k) => k.name === 'anon') ?? keys.find((k) => k.type === 'publishable'))?.api_key
if (!ANON) { console.error('✗ לא נמצא מפתח anon'); process.exit(1) }
log('Supabase מוכן:', SUPABASE_URL)

const sql = async (query, what) => {
  for (let i = 0; i < 5; i++) {
    const r = await sb('POST', `/v1/projects/${ref}/database/query`, { query })
    if (r.ok) return r.json
    if (i === 4 || r.status < 500) must(r, what)
    await sleep(5000)
  }
}
const exists = await sql(`select to_regclass('public.members') is not null as ok`, 'בדיקת טבלאות')
if (!exists?.[0]?.ok) {
  log('מריץ סכמה ו-seed…')
  await sql(readFileSync('supabase/migrations/0001_schema.sql', 'utf8'), 'סכמה')
  await sql(readFileSync('supabase/migrations/0002_seed.sql', 'utf8'), 'seed')
} else log('הטבלאות כבר קיימות, מדלג על seed')

must(await sb('PATCH', `/v1/projects/${ref}/config/auth`, { external_anonymous_users_enabled: true }), 'הפעלת כניסה אנונימית')
log('כניסה אנונימית פעילה')

let pin = null
const hasPin = await sql(`select exists(select 1 from private.app_config where key = 'pin_hash') as ok`, 'בדיקת קוד')
if (process.env.GARDA_PIN || !hasPin?.[0]?.ok) {
  pin = process.env.GARDA_PIN ?? String(randomInt(0, 10000)).padStart(4, '0')
  if (!/^\d{4}$/.test(pin)) { console.error('✗ GARDA_PIN חייב להיות 4 ספרות'); process.exit(1) }
  await sql(`select private.set_pin('${pin}')`, 'הגדרת קוד')
}

// ── 2. בילד ─────────────────────────────────────────────────
const env = { VITE_SUPABASE_URL: SUPABASE_URL, VITE_SUPABASE_ANON_KEY: ANON, VITE_MAPBOX_TOKEN: MB }
writeFileSync('.env', Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n')
log('בונה…')
execSync('npm run build', { stdio: 'inherit', env: { ...process.env, ...env, VITE_DEMO: '' } })

// ── 3. Vercel ───────────────────────────────────────────────
const proj = await vc('GET', `/v9/projects/${NAME}`)
if (proj.status === 404) must(await vc('POST', '/v10/projects', { name: NAME, framework: null }), 'יצירת פרויקט Vercel')
else must(proj, 'פרויקט Vercel')

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
const files = [...walk('dist').map((f) => ({ path: relative('dist', f), buf: readFileSync(f) })), { path: 'vercel.json', buf: readFileSync('vercel.json') }]
log(`מעלה ${files.length} קבצים ל-Vercel…`)
for (const f of files) {
  f.sha = createHash('sha1').update(f.buf).digest('hex')
  must(await vc('POST', '/v2/files', f.buf, { 'x-vercel-digest': f.sha, 'Content-Type': 'application/octet-stream', 'Content-Length': String(f.buf.length) }), `העלאת ${f.path}`)
}
let dep = must(await vc('POST', '/v13/deployments', {
  name: NAME, project: NAME, target: 'production',
  files: files.map((f) => ({ file: f.path, sha: f.sha, size: f.buf.length })),
  projectSettings: { framework: null },
}), 'פריסה')
while (!['READY', 'ERROR', 'CANCELED'].includes(dep.readyState)) {
  await sleep(3000)
  dep = must(await vc('GET', `/v13/deployments/${dep.id}`), 'מצב פריסה')
}
if (dep.readyState !== 'READY') { console.error('✗ הפריסה נכשלה:', dep.readyState); process.exit(1) }
const url = `https://${(dep.alias ?? []).find((a) => a.startsWith(NAME)) ?? dep.alias?.[0] ?? dep.url}`

console.log('\n✓ הכל מוכן')
console.log('  קישור:', url)
if (pin) console.log('  קוד משפחתי:', pin)
