export type Household = { id: string; name: string; sort: number }

export type Member = {
  id: string
  name: string
  color: string
  initials: string | null
  household_id: string
  is_admin: boolean
  guardian_id: string | null
  avatar_path: string | null
  sort: number
  active: boolean
}

export type PlaceKind =
  | 'hotel' | 'port' | 'supermarket' | 'castle' | 'park' | 'water' | 'karting'
  | 'food' | 'cafe' | 'city' | 'museum' | 'bike' | 'airport' | 'mall' | 'star'

export type Place = {
  id: string
  name: string
  name_he: string | null
  kind: PlaceKind
  lat: number
  lng: number
  address: string | null
  rain_plan: boolean
  main: boolean
  notes: string | null
  sort: number
}

export type Day = {
  date: string // YYYY-MM-DD
  title: string
  subtitle: string | null
  center_place_id: string | null
  is_shabbat: boolean
}

export type Activity = {
  id: string
  day: string
  start_time: string // HH:MM[:SS]
  end_time: string | null
  title: string
  place_id: string | null
  option_group: 'A' | 'B' | null
  household_id: string | null
  notes: string | null
  sort: number
}

export type EssentialField = { label: string; value: string; copy?: boolean }
export type Essential = {
  id: string
  household_id: string
  kind: 'flight' | 'car' | 'hotel' | 'insurance' | 'other'
  title: string
  subtitle: string | null
  fields: EssentialField[]
  address: string | null
  lat: number | null
  lng: number | null
  sort: number
}

export type EmergencyContact = {
  id: string
  household_id: string
  name: string
  name_latin: string | null
  role: string | null
  phone: string
  sort: number
}

export type TripData = {
  households: Household[]
  members: Member[]
  places: Place[]
  days: Day[]
  activities: Activity[]
  essentials: Essential[]
  emergency: EmergencyContact[]
  fetchedAt: number
}
