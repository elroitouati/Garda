import {
  Anchor, Bike, Castle, Coffee, Droplet, Flag, House, Landmark, Plane, ShoppingBag, ShoppingCart, Star, Utensils,
  type LucideProps,
} from 'lucide-react'
import type { PlaceKind } from '../lib/types'

const MAP: Record<PlaceKind, React.ComponentType<LucideProps>> = {
  hotel: House, port: Anchor, supermarket: ShoppingCart, castle: Castle, park: Star, water: Droplet,
  karting: Flag, food: Utensils, cafe: Coffee, city: Landmark, museum: Landmark, bike: Bike,
  airport: Plane, mall: ShoppingBag, star: Star,
}

export const PLACE_KINDS: { kind: PlaceKind; label: string }[] = [
  { kind: 'hotel', label: 'מלון' }, { kind: 'port', label: 'נמל' }, { kind: 'supermarket', label: 'סופר' },
  { kind: 'castle', label: 'טירה' }, { kind: 'park', label: 'פארק' }, { kind: 'water', label: 'מים/אגם' },
  { kind: 'karting', label: 'קארטינג' }, { kind: 'food', label: 'אוכל' }, { kind: 'cafe', label: 'קפה' },
  { kind: 'city', label: 'עיר' }, { kind: 'museum', label: 'מוזיאון' }, { kind: 'bike', label: 'אופניים' },
  { kind: 'airport', label: 'שדה תעופה' }, { kind: 'mall', label: 'קניות' }, { kind: 'star', label: 'אחר' },
]

export function PlaceIcon({ kind, ...p }: { kind: PlaceKind } & LucideProps) {
  const I = MAP[kind] ?? Star
  return <I {...p} />
}
