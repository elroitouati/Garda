// יוצר את תמונת התצוגה המקדימה לקישור (WhatsApp וכו') 1200×630 מהלוגו ומהציור
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_PATH || 'playwright')
const b64 = (f) => readFileSync(f).toString('base64')
const html = `<!doctype html><html dir="rtl" lang="he"><head>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@600;700&family=Secular+One&display=swap" rel="stylesheet">
<style>
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #FAF5EA; font-family: Assistant, sans-serif; position: relative; }
  .hero { position: absolute; top: 0; bottom: 0; left: 0; width: 760px; background: url(data:image/jpeg;base64,${b64('public/hero.jpg')}) 30% 55% / cover; }
  .fade { position: absolute; top: 0; bottom: 0; left: 470px; width: 300px; background: linear-gradient(to right, rgba(250,245,234,0), #FAF5EA 92%); }
  .text { position: absolute; top: 0; bottom: 0; right: 70px; width: 470px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }
  .logo { width: 132px; height: 132px; border-radius: 32px; box-shadow: 0 10px 30px rgba(0,0,0,.18); border: 5px solid #fff; }
  h1 { font-family: 'Secular One', sans-serif; font-weight: 400; font-size: 88px; line-height: 1.05; margin: 22px 0 12px; color: #1C2640; }
  .sub { font-size: 34px; font-weight: 600; color: #5E6A80; }
  .flag { margin-top: 26px; width: 150px; height: 8px; border-radius: 99px; background: linear-gradient(90deg, #2E9B4F 0 33.3%, #F4F1EA 33.3% 66.6%, #D93A3A 66.6%); }
</style></head><body>
<div class="hero"></div><div class="fade"></div>
<div class="text">
  <img class="logo" src="data:image/png;base64,${b64('public/pwa-192.png')}">
  <h1>טואטי בגארדה</h1>
  <div class="sub">הטיול המשפחתי · <bdi dir="ltr">27.9–4.10</bdi></div>
  <div class="flag"></div>
</div></body></html>`
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, ignoreHTTPSErrors: true })
await p.setContent(html, { waitUntil: 'networkidle' })
await p.evaluate(() => document.fonts.ready)
await p.screenshot({ path: 'public/og.png' })
await b.close()
