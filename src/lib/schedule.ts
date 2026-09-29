import { useEffect, useState } from 'react'
import { now, romeDate, romeToDate } from './time'
import type { Activity, Member, Place, TripData } from './types'

export type Timed = Activity & { start: Date; end: Date; place: Place | null }

/** הפעילויות שאני רואה: משותפות (חוץ ממה שהוסתר מהמשפחה שלי) + של המשפחה שלי */
export function myActivities(data: TripData, me: Member | null): Timed[] {
  const places = new Map(data.places.map((p) => [p.id, p]))
  const acts = data.activities
    .filter((a) => (!a.household_id || a.household_id === me?.household_id) && !(me && a.hidden_for?.includes(me.household_id)))
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day) || a.start_time.localeCompare(b.start_time) || a.sort - b.sort)
  return acts.map((a) => {
    const start = romeToDate(a.day, a.start_time)
    let end: Date
    if (a.end_time) end = romeToDate(a.day, a.end_time)
    else {
      const nextSame = acts.find((b) => b.day === a.day && b.start_time > a.start_time && (b.option_group === a.option_group || !b.option_group || !a.option_group))
      end = nextSame ? romeToDate(a.day, nextSame.start_time) : new Date(start.getTime() + 60 * 60000)
    }
    return { ...a, start, end, place: a.place_id ? places.get(a.place_id) ?? null : null }
  })
}

export function nowNext(list: Timed[], t: Date) {
  const current = list.filter((a) => a.start <= t && t < a.end)
  const next = list.find((a) => a.start > t) ?? null
  // נקודת המוצא לנסיעה: המקום של הפעילות הקודמת
  let from: Place | null = null
  if (next) {
    for (const a of list) {
      if (a.start >= next.start) break
      if (a.place && (!next.option_group || !a.option_group || a.option_group === next.option_group)) from = a.place
    }
  }
  return { current, next, from }
}

export function tripDayIndex(data: TripData, t: Date) {
  const today = romeDate(t)
  return data.days.findIndex((d) => d.date === today)
}

/** מתעדכן כל שנייה (או לפי הצורך) */
export function useNow(intervalMs = 1000) {
  const [t, setT] = useState(now)
  useEffect(() => {
    const id = setInterval(() => setT(now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return t
}
