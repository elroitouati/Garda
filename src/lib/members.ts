import type { Member } from './types'

/** שתי אותיות: לשבעה משתתפים השם מתחיל ב-א */
export function initialsOf(m: Pick<Member, 'name' | 'initials'>): string {
  if (m.initials) return m.initials
  const words = m.name.trim().split(/\s+/)
  if (words.length >= 2) return words[0][0] + words[1][0]
  return words[0].slice(0, 2)
}

export const MEMBER_COLORS = [
  '#C2573A', '#B8467A', '#2F6FB0', '#1F8A8A', '#9A6B12', '#5B6F2E',
  '#A0522D', '#3F5FA8', '#B7791F', '#8E3B8E', '#C04A6A', '#6B6FB0',
  '#2F6B3A', '#7A5230', '#476E7A', '#9C3D3D',
]
