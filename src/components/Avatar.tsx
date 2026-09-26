import { initialsOf } from '../lib/members'
import { useStore } from '../lib/store'
import type { Member } from '../lib/types'

type Props = {
  member: Pick<Member, 'name' | 'initials' | 'color'> & Partial<Member>
  size?: number
  ring?: boolean
  dim?: boolean
  className?: string
}

export function Avatar({ member, size = 44, ring, dim, className = '' }: Props) {
  const { avatarUrl } = useStore()
  const url = member.avatar_path ? avatarUrl(member as Member) : null
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center rounded-full font-bold text-white ${dim ? 'grayscale opacity-60' : ''} ${className}`}
      style={{
        width: size, height: size, background: member.color, fontSize: Math.round(size * 0.36),
        boxShadow: ring ? `0 0 0 3px rgb(var(--surface)), 0 0 0 5px ${member.color}` : undefined,
      }}
      aria-label={member.name}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full rounded-full object-cover" draggable={false} />
      ) : (
        <span aria-hidden>{initialsOf(member)}</span>
      )}
    </span>
  )
}
