// יוצר את תמונת התצוגה המקדימה לקישור (WhatsApp וכו') 1200×630 מתוך הפוסטר
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_PATH || 'playwright')
const svg = readFileSync(process.argv[2], 'utf8')
const html = `<!doctype html><html dir="rtl" lang="he"><head>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@600;700&family=Secular+One&display=swap" rel="stylesheet">
<style>
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #F6F0E4; font-family: Assistant, sans-serif; }
  .poster { position: absolute; top: 0; bottom: 0; left: 0; width: 740px; }
  .fade { position: absolute; top: 0; bottom: 0; left: 450px; width: 300px; background: linear-gradient(to right, rgba(246,240,228,0), #F6F0E4 92%); }
  .text { position: absolute; top: 0; bottom: 0; right: 70px; width: 500px; display: flex; flex-direction: column; justify-content: center; }
  .eyebrow { font-weight: 700; font-size: 30px; color: #C2573A; direction: ltr; text-align: right; }
  h1 { font-family: 'Secular One', sans-serif; font-weight: 400; font-size: 100px; line-height: 1.05; margin: 10px 0 18px; color: #26241E; }
  .sub { font-size: 36px; font-weight: 600; color: #5C5648; }
  .chips { display: flex; gap: 12px; margin-top: 30px; }
  .chip { background: #2F6B3A; color: #fff; font-weight: 700; font-size: 26px; padding: 10px 22px; border-radius: 999px; }
  .chip.alt { background: #fff; color: #2F6B3A; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
</style></head><body>
<div class="poster">${svg}</div><div class="fade"></div>
<div class="text">
  <div class="eyebrow">Lago di Garda · Italia</div>
  <h1>טואטי בגארדה</h1>
  <div class="sub">הטיול המשפחתי · <bdi dir="ltr">27.9–4.10</bdi></div>
  <div class="chips"><span class="chip">מפה חיה</span><span class="chip alt">לו"ז</span><span class="chip alt">אלבום</span></div>
</div></body></html>`
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, ignoreHTTPSErrors: true })
await p.setContent(html, { waitUntil: 'networkidle' })
await p.evaluate(() => document.fonts.ready)
await p.screenshot({ path: 'public/og.png' })
await b.close()
