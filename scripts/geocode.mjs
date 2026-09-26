// מאמת את קואורדינטות המקומות ב-seed מול Mapbox Geocoding ומדפיס סטיות מעל 300 מ'.
// שימוש: VITE_MAPBOX_TOKEN=pk... npm run geocode
import { readFileSync } from 'node:fs'
const token = process.env.VITE_MAPBOX_TOKEN
if (!token) { console.error('חסר VITE_MAPBOX_TOKEN'); process.exit(1) }
const sql = readFileSync('supabase/migrations/0002_seed.sql', 'utf8')
const re = /\('(\w+)',\s*'((?:[^']|'')*)',\s*'(?:[^']|'')*',\s*'\w+',\s*([\d.]+),\s*([\d.]+),\s*'((?:[^']|'')*)'/g
const dist = (a, b, c, d) => { const R = 6371e3, r = Math.PI / 180; const x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r; return Math.hypot(x, y) * R }
for (const [, id, name, lat, lng, addr] of sql.matchAll(re)) {
  const q = encodeURIComponent(`${name}, ${addr}`)
  const j = await (await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${q}&limit=1&proximity=10.54,45.53&access_token=${token}`)).json()
  const f = j.features?.[0]
  if (!f) { console.log(`?  ${id}: לא נמצא`); continue }
  const [glng, glat] = f.geometry.coordinates
  const m = Math.round(dist(+lat, +lng, glat, glng))
  console.log(`${m > 300 ? '!!' : 'ok'} ${id}: ${m} מ'  (Mapbox: ${glat.toFixed(6)}, ${glng.toFixed(6)} · ${f.properties.full_address ?? f.properties.name})`)
}
