// יוצר אייקוני PWA מ-public/favicon.svg (דורש playwright גלובלי)
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_PATH || 'playwright')
const svg = readFileSync('public/favicon.svg', 'utf8')
const b = await chromium.launch()
const p = await b.newPage()
for (const [name, size, pad, round] of [['pwa-192.png', 192, 0, true], ['pwa-512.png', 512, 0, true], ['pwa-512-maskable.png', 512, 0.1, false], ['apple-touch-icon.png', 180, 0, false]]) {
  await p.setViewportSize({ width: size, height: size })
  const inner = round ? svg : svg.replace('rx="112"', 'rx="0"')
  await p.setContent(`<body style="margin:0;background:${round ? 'transparent' : '#2F6B3A'}"><div style="padding:${size * pad}px;width:${size * (1 - 2 * pad)}px;height:${size * (1 - 2 * pad)}px">${inner.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`)
  await p.screenshot({ path: `public/${name}`, omitBackground: round })
}
await b.close()
