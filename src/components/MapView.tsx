import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Place } from '../lib/types'
import { PlaceIcon } from './PlaceIcon'

export type MapHandle = {
  fit: (pts: { lat: number; lng: number }[], opts?: { maxZoom?: number }) => void
  flyTo: (p: { lat: number; lng: number }, zoom?: number) => void
  zoomBy: (d: number) => void
  resize: () => void
}

type Props = {
  places: Place[]
  highlight: Set<string>
  selectedId: string | null
  onSelect: (p: Place | null) => void
  bottomPadding: number
}

// אחרי bundling הספרייה לא מוצאת לבד את קובץ ה-worker
maplibregl.setWorkerUrl(workerUrl)

// MapLibre + OpenFreeMap: חינמי, בלי חשבון ובלי מפתח
const STYLE = 'https://tiles.openfreemap.org/styles/positron'
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

export const MapView = forwardRef<MapHandle, Props>(function MapView({ places, highlight, selectedId, onSelect, bottomPadding }, ref) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef(new Map<string, { m: maplibregl.Marker; el: HTMLDivElement }>())
  const [, force] = useState(0)
  const [zoom, setZoom] = useState(10)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const placesRef = useRef(places)
  placesRef.current = places
  const padRef = useRef(bottomPadding)
  padRef.current = bottomPadding

  const padding = () => ({ top: 120, bottom: padRef.current + 24, left: 80, right: 56 })

  useImperativeHandle(ref, () => ({
    fit(pts, opts) {
      const m = map.current
      if (!m || !pts.length) return
      if (pts.length === 1) { m.flyTo({ center: [pts[0].lng, pts[0].lat], zoom: opts?.maxZoom ?? 13.5, padding: padding(), essential: true }); return }
      const b = new maplibregl.LngLatBounds()
      pts.forEach((p) => b.extend([p.lng, p.lat]))
      m.fitBounds(b, { padding: padding(), maxZoom: opts?.maxZoom ?? 14, duration: 1400, essential: true })
    },
    flyTo(p, z) { map.current?.flyTo({ center: [p.lng, p.lat], zoom: z ?? 15, padding: padding(), essential: true }) },
    zoomBy(d) { const m = map.current; if (m) m.easeTo({ zoom: m.getZoom() + d, duration: 300 }) },
    resize() { map.current?.resize() },
  }))

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
    m.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 90 }), 'top-left')
    m.touchZoomRotate.disableRotation()
    m.on('style.load', () => { recolor(m); addTerrain(m) })
    m.on('error', (e) => console.warn('map', e.error?.message))
    m.on('zoom', () => setZoom(m.getZoom()))
    m.on('click', (e) => { if (!(e.originalEvent.target as HTMLElement).closest('.place-marker')) onSelectRef.current(null) })
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
