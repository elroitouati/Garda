import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAPBOX_TOKEN } from '../lib/env'
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

const MONIGA = { lng: 10.5357, lat: 45.5362 }
const dark = () => window.matchMedia('(prefers-color-scheme: dark)').matches
const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()

/** צביעת סגנון Mapbox בצבעי ה-tokens: יבשה קרם, מים טורקיז, כבישים עדינים, מעט טקסט */
function recolor(map: mapboxgl.Map) {
  const land = cssVar('--map-land'), water = cssVar('--map-water'), road = cssVar('--map-road'), green = cssVar('--map-green')
  const keepLabels = /^(settlement-major-label|settlement-minor-label|water-point-label|water-line-label|natural-point-label)$/
  for (const l of map.getStyle()?.layers ?? []) {
    const id = l.id
    try {
      if (l.type === 'fill' && /building/.test(id)) map.setPaintProperty(id, 'fill-color', dark() ? '#2A2822' : '#E6DCC6')
      else if (l.type === 'background') map.setPaintProperty(id, 'background-color', land)
      else if (l.type === 'fill' && /^(land$|landcover|national-park|landuse)/.test(id)) {
        if (/national-park|landuse|landcover/.test(id)) map.setPaintProperty(id, 'fill-color', green)
        else map.setPaintProperty(id, 'fill-color', land)
      } else if (l.type === 'fill' && /^water/.test(id)) map.setPaintProperty(id, 'fill-color', water)
      else if (l.type === 'line' && /^waterway/.test(id)) map.setPaintProperty(id, 'line-color', water)
      else if (l.type === 'line' && /(road|bridge|tunnel)/.test(id) && !/label|shield/.test(id)) {
        map.setPaintProperty(id, 'line-color', road)
      } else if (l.type === 'symbol' && !keepLabels.test(id)) map.setLayoutProperty(id, 'visibility', 'none')
      else if (l.type === 'fill-extrusion') map.setPaintProperty(id, 'fill-extrusion-color', dark() ? '#2A2822' : '#E6DCC6')
    } catch { /* שכבה שלא תומכת בתכונה */ }
  }
}

function addTerrain(map: mapboxgl.Map) {
  if (!map.getSource('mapbox-dem')) {
    map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 })
  }
  map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.35 })
  const firstRoad = map.getStyle()?.layers?.find((l) => /road|tunnel/.test(l.id))?.id
  if (!map.getLayer('hills')) {
    map.addLayer({
      id: 'hills', type: 'hillshade', source: 'mapbox-dem',
      paint: {
        'hillshade-shadow-color': dark() ? '#000000' : '#8A7A5A',
        'hillshade-highlight-color': dark() ? '#3A3A30' : '#FFF8E8',
        'hillshade-exaggeration': 0.45,
      },
    }, firstRoad)
  }
  map.setFog({ color: cssVar('--map-land'), 'horizon-blend': 0.08, 'high-color': dark() ? '#1a2a3a' : '#CFE6F0', 'space-color': dark() ? '#0b0f14' : '#DDEBF2' } as mapboxgl.FogSpecification)
}

export const MapView = forwardRef<MapHandle, Props>(function MapView({ places, highlight, selectedId, onSelect, bottomPadding }, ref) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef(new Map<string, { m: mapboxgl.Marker; el: HTMLDivElement }>())
  const [, force] = useState(0)
  const [zoom, setZoom] = useState(10)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const placesRef = useRef(places)
  placesRef.current = places
  const padRef = useRef(bottomPadding)
  padRef.current = bottomPadding

  const padding = () => ({ top: 90, bottom: padRef.current + 24, left: 56, right: 56 })

  useImperativeHandle(ref, () => ({
    fit(pts, opts) {
      const m = map.current
      if (!m || !pts.length) return
      if (pts.length === 1) { m.flyTo({ center: [pts[0].lng, pts[0].lat], zoom: opts?.maxZoom ?? 13.5, padding: padding(), essential: true }); return }
      const b = new mapboxgl.LngLatBounds()
      pts.forEach((p) => b.extend([p.lng, p.lat]))
      m.fitBounds(b, { padding: padding(), maxZoom: opts?.maxZoom ?? 14, duration: 1400, essential: true })
    },
    flyTo(p, z) { map.current?.flyTo({ center: [p.lng, p.lat], zoom: z ?? 15, padding: padding(), essential: true }) },
    zoomBy(d) { const m = map.current; if (m) m.easeTo({ zoom: m.getZoom() + d, duration: 300 }) },
    resize() { map.current?.resize() },
  }))

  useEffect(() => {
    if (!el.current || !MAPBOX_TOKEN) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    const m = new mapboxgl.Map({
      container: el.current,
      style: dark() ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
      center: [MONIGA.lng, MONIGA.lat],
      zoom: 10,
      pitch: 28,
      attributionControl: false,
      cooperativeGestures: false,
      language: 'he',
    } as mapboxgl.MapOptions)
    map.current = m
    m.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')
    m.addControl(new mapboxgl.ScaleControl({ unit: 'metric', maxWidth: 90 }), 'top-left')
    m.touchZoomRotate.disableRotation()
    m.on('style.load', () => { recolor(m); addTerrain(m) })
    m.on('zoom', () => setZoom(m.getZoom()))
    m.on('click', (e) => { if (!(e.originalEvent.target as HTMLElement).closest('.place-marker')) onSelectRef.current(null) })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => { m.setStyle(dark() ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11') }
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
        const mk = new mapboxgl.Marker({ element: div, anchor: 'top', offset: [0, -19] }).setLngLat([p.lng, p.lat]).addTo(m)
        entry = { m: mk, el: div }
        markers.current.set(p.id, entry)
      } else entry.m.setLngLat([p.lng, p.lat])
    }
    for (const [id, e] of markers.current) if (!seen.has(id)) { e.m.remove(); markers.current.delete(id) }
    force((x) => x + 1)
  }, [places])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-surface2 p-8 pb-[50vh] text-center text-muted">
        המפה לא זמינה: חסר טוקן Mapbox (VITE_MAPBOX_TOKEN).
      </div>
    )
  }

  return (
    <>
      <div ref={el} className="absolute inset-0" />
      {places.map((p) => {
        const entry = markers.current.get(p.id)
        if (!entry) return null
        const today = highlight.has(p.id)
        const sel = selectedId === p.id
        entry.el.className = `place-marker${today ? ' is-today' : ''}${sel ? ' is-selected' : ''}${p.rain_plan && !p.main ? ' is-rain' : ''}`
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
