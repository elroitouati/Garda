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
  hidden_for?: string[] // משפחות שלא רואות את הפעילות המשותפת
  notes: string | null
  sort: number
}

export type EssentialField = { label: string; value: string; copy?: boolean }
export type Essential = {
  id: string
  household_id: string | null // null = משותף לכולם
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
  member_id?: string | null
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
  shabbat: Shabbat | null
  fetchedAt: number
}

export type Message = {
  id: string
  sender_id: string
  body: string
  important: boolean
  audience: 'all' | 'household' | 'custom'
  household_id: string | null
  recipients: string[] | null
  lat: number | null
  lng: number | null
  reminded_at: string | null
  created_at: string
}

export type MessageRead = { message_id: string; member_id: string; read_at: string }

export type Photo = {
  id: string
  member_id: string
  path: string
  thumb_path: string
  lat: number
  lng: number
  loc_source: 'device' | 'exif' | 'schedule' | 'manual'
  taken_at: string
  width: number | null
  height: number | null
  kind: 'photo' | 'video'
  duration: number | null // שניות, לסרטון
  created_at: string
}

export type PhotoLike = { photo_id: string; member_id: string; created_at: string }
export type PhotoComment = { id: string; photo_id: string; member_id: string; body: string; created_at: string }

export type LiveData = {
  messages: Message[]; reads: MessageRead[]; photos: Photo[]; locations: Location[]; meetings: Meeting[]
  likes: PhotoLike[]; comments: PhotoComment[]
}

export type Location = {
  member_id: string
  lat: number | null
  lng: number | null
  accuracy: number | null
  heading: number | null
  sharing: boolean
  updated_at: string
}

export type Meeting = {
  id: string
  created_by: string
  title: string
  lat: number
  lng: number
  meet_at: string
  audience: 'all' | 'household'
  household_id: string | null
  active: boolean
  created_at: string
}

export type Shabbat = { id: number; title: string; candles: string; havdalah: string }
