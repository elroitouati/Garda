// Open-Meteo: חינמי, בלי מפתח. תחזית יומית לפי מקום היום.
import type { Day, Place } from './types'

export type DayWeather = { code: number; max: number; min: number; rain: number }
const KEY = 'garda-weather-v1'

export async function fetchWeather(days: Day[], places: Place[]): Promise<Record<string, DayWeather>> {
  let cached: { at: number; data: Record<string, DayWeather> } | null = null
  try { cached = JSON.parse(localStorage.getItem(KEY) || 'null') } catch { /* ignore */ }
  if (cached && Date.now() - cached.at < 3 * 3600_000) return cached.data
  const byPlace = new Map<string, Day[]>()
  for (const d of days) {
    const pid = d.center_place_id ?? 'hotel'
    byPlace.set(pid, [...(byPlace.get(pid) ?? []), d])
  }
  const out: Record<string, DayWeather> = {}
  await Promise.all([...byPlace.entries()].map(async ([pid, ds]) => {
    const p = places.find((x) => x.id === pid) ?? places.find((x) => x.kind === 'hotel')
    if (!p) return
    const start = ds[0].date, end = ds[ds.length - 1].date
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FRome&start_date=${start}&end_date=${end}`
    try {
      const j = await (await fetch(url)).json()
      j.daily?.time?.forEach((t: string, i: number) => {
        if (ds.some((d) => d.date === t)) out[t] = {
          code: j.daily.weather_code[i], max: Math.round(j.daily.temperature_2m_max[i]),
          min: Math.round(j.daily.temperature_2m_min[i]), rain: j.daily.precipitation_probability_max[i] ?? 0,
        }
      })
    } catch { /* אופליין */ }
  }))
  if (Object.keys(out).length) localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data: out }))
  else if (cached) return cached.data
  return out
}
