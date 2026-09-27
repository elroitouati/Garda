// הקמה ופריסה אוטומטית מקצה לקצה. אפשר להריץ שוב ושוב (לא יוצר כפילויות).
//
// צריך משתנה סביבה אחד:
//   SUPABASE_ACCESS_TOKEN  — supabase.com/dashboard/account/tokens
// אופציונלי: GARDA_PIN (אחרת נוצר קוד אקראי ומודפס)
// הפריסה היא ל-GitHub Pages (scripts/deploy-pages.sh), והמפה חינמית בלי מפתח.
//
// שימוש: npm run setup
import { execSync } from 'node:child_process'
import { randomBytes, randomInt } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const NAME = 'tuati-garda'
const SB = process.env.SUPABASE_ACCESS_TOKEN
if (!SB) { console.error('חסר משתנה הסביבה SUPABASE_ACCESS_TOKEN'); process.exit(1) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log('›', ...a)

async function http(base, token, method, path, body, extraHeaders = {}) {
  const r = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  return { ok: r.ok, status: r.status, json }
}
const sb = (m, p, b) => http('https://api.supabase.com', SB, m, p, b)
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
// מריץ כל קובץ migration פעם אחת בלבד, לפי הסדר
await sql(`create schema if not exists private; create table if not exists private.applied_migrations (name text primary key, at timestamptz default now())`, 'טבלת migrations')
const applied = new Set((await sql(`select name from private.applied_migrations`, 'migrations שרצו')).map((r) => r.name))
// התקנה ישנה בלי מעקב: הסכמה וה-seed כבר קיימים
if (!applied.size && (await sql(`select to_regclass('public.members') is not null as ok`, 'בדיקת טבלאות'))?.[0]?.ok) {
  for (const n of ['0001_schema.sql', '0002_seed.sql']) applied.add(n)
  await sql(`insert into private.applied_migrations(name) values ('0001_schema.sql'), ('0002_seed.sql') on conflict do nothing`, 'סימון')
}
for (const name of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) {
  if (applied.has(name)) continue
  log('מריץ', name)
  await sql(readFileSync(`supabase/migrations/${name}`, 'utf8'), name)
  await sql(`insert into private.applied_migrations(name) values ('${name}')`, 'סימון migration')
}

must(await sb('PATCH', `/v1/projects/${ref}/config/auth`, { external_anonymous_users_enabled: true }), 'הפעלת כניסה אנונימית')
log('כניסה אנונימית פעילה')

let pin = null
const hasPin = await sql(`select exists(select 1 from private.app_config where key = 'pin_hash') as ok`, 'בדיקת קוד')
if (process.env.GARDA_PIN || !hasPin?.[0]?.ok) {
  pin = process.env.GARDA_PIN ?? String(randomInt(0, 10000)).padStart(4, '0')
  if (!/^\d{4}$/.test(pin)) { console.error('✗ GARDA_PIN חייב להיות 4 ספרות'); process.exit(1) }
  await sql(`select private.set_pin('${pin}')`, 'הגדרת קוד')
}

// ── 2. בילד ופריסה ל-GitHub Pages ─────────────────────────
writeFileSync('.env', `VITE_SUPABASE_URL=${SUPABASE_URL}\nVITE_SUPABASE_ANON_KEY=${ANON}\n`)
log('בונה ופורס…')
execSync('./scripts/deploy-pages.sh', { stdio: 'inherit' })

console.log('\n✓ הכל מוכן')
console.log('  קישור: https://elroitouati.github.io/Garda/')
if (pin) console.log('  קוד משפחתי:', pin)
