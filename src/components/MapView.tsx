import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Photo, Place } from '../lib/types'
import { PlaceIcon } from './PlaceIcon'

export type MapHandle = {
  fit: (pts: { lat: number; lng: number }[], opts?: { maxZoom?: number; duration?: number }) => void
  jump: (p: { lat: number; lng: number }, zoom: number) => void
  flyTo: (p: { lat: number; lng: number }, zoom?: number) => void
  zoomBy: (d: number) => void
  resize: () => void
  center: () => { lat: number; lng: number } | null
  /** הנקודה במרכז האזור הגלוי מעל החלונית (שם עומדת הסיכה) */
  visibleCenter: () => { lat: number; lng: number } | null
  /** מתי המשתמש הזיז את המפה בפעם האחרונה (לא תנועה של הקוד) */
  lastUserMove: () => number
}

type Props = {
  places: Place[]
  highlight: Set<string>
  selectedId: string | null
  onSelect: (p: Place | null) => void
  bottomPadding: number
  photos?: Photo[]
  thumbUrl?: (path: string) => string | null
  onPhotos?: (ids: string[]) => void
  people?: MapPerson[]
  onPerson?: (id: string) => void
  meeting?: MapMeeting | null
  onLongPress?: (p: { lat: number; lng: number }) => void
}

export type MapPerson = {
  id: string; name: string; color: string; initials: string; avatar: string | null
  lat: number; lng: number; live: boolean; stale: boolean; paused: boolean; isMe: boolean
  heading: number | null; kids: string[]
}
export type MapMeeting = { key: string; title: string; lat: number; lng: number; route: [number, number][] | null }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
function personHTML(p: MapPerson, size: number) {
  const inner = p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : `<span>${esc(p.initials)}</span>`
  return `<span class="pm-dot" style="width:${size}px;height:${size}px;background:${esc(p.color)};font-size:${Math.round(size * 0.36)}px">${inner}</span>`
}


// אחרי bundling הספרייה לא מוצאת לבד את קובץ ה-worker
maplibregl.setWorkerUrl(workerUrl)

// MapLibre + OpenFreeMap: חינמי, בלי חשבון ובלי מפתח
export const STYLE = 'https://tiles.openfreemap.org/styles/positron'
const MONIGA = { lng: 10.5357, lat: 45.5362 }
const dark = () => window.matchMedia('(prefers-color-scheme: dark)').matches
const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()

/** צביעת המפה בצבעי ה-tokens: יבשה קרם, מים טורקיז, כבישים עדינים, מעט טקסט */
function recolor(map: maplibregl.Map) {
  const land = cssVar('--map-land'), water = cssVar('--map-water'), road = cssVar('--map-road'), green = cssVar('--map-green')
  const casing = dark() ? '#2A2822' : '#DCCFB2'
  const building = dark() ? '#2A2822' : '#E6DCC6'
  const keepLabels = /^(water_name_point_label|label_village|label_town|label_city|label_city_capital)$/
  for (const l of map.getStyle()?.layers ?? []) {
    const id = l.id
    try {
      if (l.type === 'background') map.setPaintProperty(id, 'background-color', land)
      else if (l.type === 'fill' && /^(park|landcover_wood)$/.test(id)) map.setPaintProperty(id, 'fill-color', green)
      else if (l.type === 'fill' && /^landuse/.test(id)) map.setPaintProperty(id, 'fill-color', land)
      else if (l.type === 'fill' && id === 'water') map.setPaintProperty(id, 'fill-color', water)
      else if (l.type === 'line' && id === 'waterway') map.setPaintProperty(id, 'line-color', water)
      else if (l.type === 'fill' && id === 'building') map.setPaintProperty(id, 'fill-color', building)
      else if (l.type === 'line' && /casing/.test(id)) map.setPaintProperty(id, 'line-color', casing)
      else if (l.type === 'line' && /^(highway|tunnel|road)/.test(id)) map.setPaintProperty(id, 'line-color', road)
      else if (l.type === 'symbol' && !keepLabels.test(id)) map.setLayoutProperty(id, 'visibility', 'none')
      else if (l.type === 'symbol') {
        map.setPaintProperty(id, 'text-color', cssVar('--map-label'))
        map.setPaintProperty(id, 'text-halo-color', land)
      }
    } catch { /* שכבה שלא תומכת בתכונה */ }
  }
}

// תבליט (hillshade) מגבהים חינמיים של AWS. בלי תלת־ממד אמיתי: הוא מזיז את הסמנים ומכביד על הסוללה
function addTerrain(map: maplibregl.Map) {
  for (const id of ['dem-shade']) {
    if (!map.getSource(id)) {
      map.addSource(id, {
        type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 14,
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        attribution: 'Terrain: Mapzen/AWS',
      })
    }
  }
  const firstLine = map.getStyle()?.layers?.find((l) => l.id === 'waterway' || l.id === 'building')?.id
  if (!map.getLayer('hills')) {
    map.addLayer({
      id: 'hills', type: 'hillshade', source: 'dem-shade',
      paint: {
        'hillshade-shadow-color': dark() ? '#000000' : '#8A7A5A',
        'hillshade-highlight-color': dark() ? '#3A3A30' : '#FFF8E8',
        'hillshade-exaggeration': 0.5,
      },
    }, firstLine)
  }
}

export const MapView = forwardRef<MapHandle, Props>(function MapView({ places, highlight, selectedId, onSelect, bottomPadding, photos = [], thumbUrl, onPhotos, people = [], onPerson, meeting = null, onLongPress }, ref) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef(new Map<string, { m: maplibregl.Marker; el: HTMLDivElement }>())
  const [, force] = useState(0)
  const [zoom, setZoom] = useState(10)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const longPressRef = useRef(onLongPress)
  longPressRef.current = onLongPress
  const placesRef = useRef(places)
  placesRef.current = places
  const padRef = useRef(bottomPadding)
  padRef.current = bottomPadding

  const padding = () => ({ top: 120, bottom: padRef.current + 24, left: 80, right: 56 })

  const userMove = useRef(0)
  useImperativeHandle(ref, () => ({
    lastUserMove: () => userMove.current,
    fit(pts, opts) {
      const m = map.current
      if (!m || !pts.length) return
      if (pts.length === 1) { m.flyTo({ center: [pts[0].lng, pts[0].lat], zoom: opts?.maxZoom ?? 13.5, padding: padding(), essential: true, ...(opts?.duration ? { duration: opts.duration, curve: 1.6 } : {}) }); return }
      const b = new maplibregl.LngLatBounds()
      pts.forEach((p) => b.extend([p.lng, p.lat]))
      const cam = m.cameraForBounds(b, { padding: padding(), maxZoom: opts?.maxZoom ?? 14 })
      if (cam) m.flyTo({ ...cam, essential: true, duration: opts?.duration ?? 1400, curve: 1.5 })
    },
    jump(p, zoom) {
      const m = map.current
      if (!m) return
      const go = () => m.jumpTo({ center: [p.lng, p.lat], zoom })
      go()
      // הסגנון עלול להחזיר את המצלמה כשהוא נטען — מחילים שוב
      if (!m.isStyleLoaded()) m.once('load', go)
    },
    flyTo(p, z) { map.current?.flyTo({ center: [p.lng, p.lat], zoom: z ?? 15, padding: padding(), essential: true }) },
    zoomBy(d) { const m = map.current; if (m) m.easeTo({ zoom: m.getZoom() + d, duration: 300 }) },
    resize() { map.current?.resize() },
    center() { const c = map.current?.getCenter(); return c ? { lat: c.lat, lng: c.lng } : null },
    visibleCenter() {
      const m = map.current
      if (!m) return null
      const sheet = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-h')) || 0
      const rect = m.getContainer().getBoundingClientRect()
      const ll = m.unproject([rect.width / 2, (rect.height - sheet) / 2])
      return { lat: ll.lat, lng: ll.lng }
    },
  }))

  // ── תמונות על המפה: מתאחדות לבועות לפי קרבה על המסך ──
  const photoMarkers = useRef<maplibregl.Marker[]>([])
  const photoRef = useRef({ photos, thumbUrl, onPhotos })
  photoRef.current = { photos, thumbUrl, onPhotos }
  const drawPhotos = useRef(() => {})
  drawPhotos.current = () => {
    const m = map.current
    if (!m) return
    photoMarkers.current.forEach((x) => x.remove())
    photoMarkers.current = []
    const { photos: list, thumbUrl: url, onPhotos: cb } = photoRef.current
    const cells = new Map<string, Photo[]>()
    for (const ph of list) {
      const pt = m.project([ph.lng, ph.lat])
      const k = `${Math.floor(pt.x / 64)}:${Math.floor(pt.y / 64)}`
      cells.set(k, [...(cells.get(k) ?? []), ph])
    }
    for (const group of cells.values()) {
      const lat = group.reduce((a, x) => a + x.lat, 0) / group.length
      const lng = group.reduce((a, x) => a + x.lng, 0) / group.length
      // ה-transform של השורש שמור ל-MapLibre, לכן העיצוב על אלמנט פנימי
      const root = document.createElement('div')
      root.style.zIndex = '4'
      const div = document.createElement('button')
      div.className = 'photo-marker'
      div.setAttribute('aria-label', `${group.length} תמונות`)
      const src = url?.(group[0].thumb_path)
      if (src) { const img = document.createElement('img'); img.src = src; img.alt = ''; div.appendChild(img) }
      if (group.length > 1) { const b = document.createElement('span'); b.className = 'photo-count tnum'; b.textContent = String(group.length); div.appendChild(b) }
      else if (group[0].kind === 'video') { const b = document.createElement('span'); b.className = 'photo-count'; b.textContent = '▶'; div.appendChild(b) }
      div.addEventListener('click', (ev) => { ev.stopPropagation(); cb?.(group.map((x) => x.id)) })
      root.appendChild(div)
      photoMarkers.current.push(new maplibregl.Marker({ element: root }).setLngLat([lng, lat]).addTo(m))
    }
  }
  useEffect(() => { drawPhotos.current() }, [photos, thumbUrl])

  // ── בני המשפחה: אוואטרים בגודל קבוע, מתאחדים לבועות כשמתרחקים ──
  const peopleMarkers = useRef<maplibregl.Marker[]>([])
  const peopleRef = useRef({ people, onPerson })
  peopleRef.current = { people, onPerson }
  const shownName = useRef<string | null>(null)
  const drawPeople = useRef(() => {})
  drawPeople.current = () => {
    const m = map.current
    if (!m) return
    peopleMarkers.current.forEach((x) => x.remove())
    peopleMarkers.current = []
    const { people: list, onPerson: cb } = peopleRef.current
    const me = list.find((p) => p.isMe)
    if (me) {
      const el = document.createElement('div')
      el.className = 'me-dot'
      el.innerHTML = `${me.heading != null ? `<span class="me-cone" style="transform:rotate(${me.heading}deg)"></span>` : ''}<span class="me-core"></span>`
      el.setAttribute('aria-label', 'אני')
      el.style.zIndex = '12'
      peopleMarkers.current.push(new maplibregl.Marker({ element: el }).setLngLat([me.lng, me.lat]).addTo(m))
    }
    const cells = new Map<string, MapPerson[]>()
    for (const p of list) {
      if (p.isMe) continue
      const pt = m.project([p.lng, p.lat])
      const k = `${Math.floor(pt.x / 56)}:${Math.floor(pt.y / 56)}`
      cells.set(k, [...(cells.get(k) ?? []), p])
    }
    for (const group of cells.values()) {
      const lat = group.reduce((a, x) => a + x.lat, 0) / group.length
      const lng = group.reduce((a, x) => a + x.lng, 0) / group.length
      const el = document.createElement('button')
      if (group.length === 1) {
        const p = group[0]
        el.className = `person-marker${p.live && !p.paused ? ' is-live' : ''}${p.stale || p.paused ? ' is-stale' : ''}${p.paused ? ' is-paused' : ''}`
        el.style.setProperty('--c', p.color)
        el.innerHTML = `<span class="pm-ring"></span>${personHTML(p, 42)}${p.kids.length ? `<span class="pm-kids">+${p.kids.length}</span>` : ''}<span class="pm-name${shownName.current === p.id ? ' show' : ''}">${esc(p.name)}${p.paused ? ' · מושהה' : ''}</span>`
        el.setAttribute('aria-label', p.name)
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          shownName.current = shownName.current === p.id ? null : p.id
          el.querySelector('.pm-name')?.classList.toggle('show', shownName.current === p.id)
          cb?.(p.id)
        })
      } else {
        el.className = 'people-cluster'
        const shown = group.slice(0, 4)
        el.innerHTML = shown.map((p) => personHTML(p, 30)).join('') + (group.length > 4 ? `<span class="pc-more">+${group.length - 4}</span>` : '')
        el.setAttribute('aria-label', group.map((p) => p.name).join(', '))
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          const b = new maplibregl.LngLatBounds()
          group.forEach((p) => b.extend([p.lng, p.lat]))
          m.fitBounds(b, { padding: padding(), maxZoom: Math.min(18, m.getZoom() + 4), duration: 700 })
        })
      }
      el.style.zIndex = '10'
      peopleMarkers.current.push(new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(m))
    }
  }
  useEffect(() => { drawPeople.current() }, [people])

  // ── נקודת מפגש: סיכה נופלת, קווים מקווקווים מונפשים ומסלול הליכה ──
  const meetMarker = useRef<{ key: string; m: maplibregl.Marker } | null>(null)
  const meetRef = useRef({ meeting, people })
  meetRef.current = { meeting, people }
  const drawMeeting = useRef(() => {})
  drawMeeting.current = () => {
    const m = map.current
    if (!m || !m.isStyleLoaded()) return
    const { meeting: mt, people: list } = meetRef.current
    if (meetMarker.current && meetMarker.current.key !== mt?.key) { meetMarker.current.m.remove(); meetMarker.current = null }
    if (mt && !meetMarker.current) {
      const el = document.createElement('div')
      el.innerHTML = `<div class="meet-pin"><span class="mp-head"></span><span class="mp-label">${esc(mt.title)}</span></div>`
      el.style.zIndex = '11'
      meetMarker.current = { key: mt.key, m: new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([mt.lng, mt.lat]).addTo(m) }
    }
    const lines = mt ? list.filter((p) => !p.paused && !p.stale).map((p) => ({
      type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [[p.lng, p.lat], [mt.lng, mt.lat]] },
    })) : []
    const route = mt?.route ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: mt.route } }] : []
    const set = (id: string, features: unknown[]) => {
      const src = m.getSource(id) as maplibregl.GeoJSONSource | undefined
      const data = { type: 'FeatureCollection', features } as Parameters<maplibregl.GeoJSONSource['setData']>[0]
      if (src) src.setData(data)
      else m.addSource(id, { type: 'geojson', data })
    }
    set('meet-route', route)
    set('meet-lines', lines)
    const terra = cssVar('--terra') ? `rgb(${cssVar('--terra').split(' ').join(',')})` : '#C2573A'
    if (!m.getLayer('meet-route')) m.addLayer({ id: 'meet-route', type: 'line', source: 'meet-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': terra, 'line-width': 5, 'line-opacity': 0.55 } })
    if (!m.getLayer('meet-lines')) m.addLayer({ id: 'meet-lines', type: 'line', source: 'meet-lines', layout: { 'line-cap': 'round' }, paint: { 'line-color': terra, 'line-width': 2.5, 'line-dasharray': [0, 4, 3] } })
  }
  useEffect(() => { drawMeeting.current() }, [meeting, people])
  // הנפשת הקווקוו
  useEffect(() => {
    if (!meeting || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const seq = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]]
    let i = 0
    const t = setInterval(() => {
      const m = map.current
      if (m?.getLayer('meet-lines')) m.setPaintProperty('meet-lines', 'line-dasharray', seq[i = (i + 1) % seq.length])
    }, 90)
    return () => clearInterval(t)
  }, [meeting?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!el.current) return
    const m = new maplibregl.Map({
      container: el.current,
      style: STYLE,
      center: [MONIGA.lng, MONIGA.lat],
      zoom: 10,
      pitch: 0,
      maxPitch: 0,
      dragRotate: false,
      attributionControl: false,
    })
    map.current = m
    if (import.meta.env.VITE_DEMO === '1') (window as unknown as { __map: unknown }).__map = m
    m.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 90 }), 'top-left')
    m.touchZoomRotate.disableRotation()
    m.on('style.load', () => { recolor(m); addTerrain(m) })
    m.on('error', (e) => console.warn('map', e.error?.message))
    m.on('zoom', () => setZoom(m.getZoom()))
    m.on('moveend', () => { drawPhotos.current(); drawPeople.current() })
    m.on('load', () => { drawPhotos.current(); drawPeople.current(); drawMeeting.current() })
    m.on('movestart', (e) => { if ((e as { originalEvent?: Event }).originalEvent) userMove.current = Date.now() })
    // לחיצה ארוכה על המפה → נקודת מפגש
    let lp: ReturnType<typeof setTimeout> | undefined
    const cancelLp = () => clearTimeout(lp)
    m.on('touchstart', (e) => {
      cancelLp()
      if (e.originalEvent.touches.length !== 1) return
      const ll = e.lngLat
      lp = setTimeout(() => { navigator.vibrate?.(30); longPressRef.current?.({ lat: ll.lat, lng: ll.lng }) }, 600)
    })
    m.on('touchend', cancelLp); m.on('touchmove', cancelLp); m.on('movestart', cancelLp)
    m.on('contextmenu', (e) => longPressRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }))
    m.on('click', (e) => { if (!(e.originalEvent.target as HTMLElement).closest('.place-marker, .photo-marker, .person-marker, .people-cluster')) onSelectRef.current(null) })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => recolor(m)
    mq.addEventListener('change', onScheme)
    return () => { mq.removeEventListener('change', onScheme); m.remove(); map.current = null; markers.current.clear() }
  }, [])


  // סמני מקומות (HTML בגודל קבוע)
  useEffect(() => {
    const m = map.current
    if (!m) return
    const seen = new Set<string>()
    for (const p of places) {
      seen.add(p.id)
      let entry = markers.current.get(p.id)
      if (!entry) {
        const div = document.createElement('div')
        div.className = 'place-marker'
        const id = p.id
        div.addEventListener('click', (ev) => {
          ev.stopPropagation()
          const cur = placesRef.current.find((x) => x.id === id)
          if (cur) onSelectRef.current(cur)
        })
        const mk = new maplibregl.Marker({ element: div, anchor: 'top', offset: [0, -19] }).setLngLat([p.lng, p.lat]).addTo(m)
        entry = { m: mk, el: div }
        markers.current.set(p.id, entry)
      } else entry.m.setLngLat([p.lng, p.lat])
    }
    for (const [id, e] of markers.current) if (!seen.has(id)) { e.m.remove(); markers.current.delete(id) }
    force((x) => x + 1)
  }, [places])

  return (
    <>
      <div ref={el} className="absolute inset-0" />
      {places.map((p) => {
        const entry = markers.current.get(p.id)
        if (!entry) return null
        const today = highlight.has(p.id)
        const sel = selectedId === p.id
        // classList ולא className: MapLibre שם על האלמנט מחלקות מיקום משלו
        entry.el.classList.toggle('is-today', today)
        entry.el.classList.toggle('is-selected', sel)
        entry.el.classList.toggle('is-rain', p.rain_plan && !p.main)
        // פחות רעש: מקומות שלא שייכים להיום הם נקודה קטנה עד שמתקרבים
        entry.el.classList.toggle('is-minor', !today && !sel && zoom < 12.5)
        entry.el.style.zIndex = sel ? '5' : today ? '3' : '1'
        const showLabel = sel || today || zoom >= 12.5
        return createPortal(
          <>
            <span className="place-pin" role="button" aria-label={p.name_he ?? p.name}><PlaceIcon kind={p.kind} size={19} strokeWidth={2.2} /></span>
            {showLabel && <span className="place-label"><bdi>{p.name_he ?? p.name}</bdi></span>}
          </>,
          entry.el,
          p.id,
        )
      })}
    </>
  )
})
