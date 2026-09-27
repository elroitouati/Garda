// מאמת את קואורדינטות המקומות ב-seed מול OpenStreetMap (Nominatim) ומדפיס סטיות מעל 300 מ'.
// שימוש: npm run geocode
import { readFileSync } from 'node:fs'
const sql = readFileSync('supabase/migrations/0002_seed.sql', 'utf8')
const re = /\('(\w+)',\s*'((?:[^']|'')*)',\s*'(?:[^']|'')*',\s*'\w+',\s*([\d.]+),\s*([\d.]+),\s*'((?:[^']|'')*)'/g
const dist = (a, b, c, d) => { const R = 6371e3, r = Math.PI / 180; const x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r; return Math.hypot(x, y) * R }
for (const [, id, name, lat, lng, addr] of sql.matchAll(re)) {
  const q = encodeURIComponent(`${name}, ${addr}`)
  const j = await (await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, { headers: { 'User-Agent': 'tuati-garda/1.0' } })).json()
  await new Promise((r) => setTimeout(r, 1100))
  if (!j[0]) { console.log(`?  ${id}: לא נמצא`); continue }
  const m = Math.round(dist(+lat, +lng, +j[0].lat, +j[0].lon))
  console.log(`${m > 300 ? '!!' : 'ok'} ${id}: ${m} מ'  (OSM: ${j[0].lat}, ${j[0].lon} · ${j[0].display_name.slice(0, 80)})`)
}
