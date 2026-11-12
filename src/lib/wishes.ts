import type { Member } from './types'

export type WishKind = 'birthday' | 'anniversary'

export interface Wish {
  member: Member
  kind: WishKind
  /** 0 means today. */
  daysAway: number
  /** The next time this day comes round. */
  on: Date
}

/** "Upcoming" looks this many days ahead. */
export const UPCOMING_DAYS = 30

const DAY = 24 * 60 * 60 * 1000

function parseDay(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? { m: Number(m[2]), d: Number(m[3]) } : null
}

/** Birthdays and anniversaries from today up to UPCOMING_DAYS ahead, soonest first. */
export function wishesFor(members: Member[], nowMs: number): Wish[] {
  const n = new Date(nowMs)
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate())
  const out: Wish[] = []

  for (const member of members) {
    const p = member.profile
    const days: [WishKind, string][] = [
      ['birthday', p.dob],
      ['anniversary', p.married === 'yes' ? p.anniversary : ''],
    ]
    for (const [kind, raw] of days) {
      const parsed = parseDay(raw)
      if (!parsed) continue
      let on = new Date(today.getFullYear(), parsed.m - 1, parsed.d)
      if (on < today) on = new Date(today.getFullYear() + 1, parsed.m - 1, parsed.d)
      const daysAway = Math.round((on.getTime() - today.getTime()) / DAY)
      if (daysAway <= UPCOMING_DAYS) out.push({ member, kind, daysAway, on })
    }
  }
  return out.sort((a, b) => a.daysAway - b.daysAway || a.member.name.localeCompare(b.member.name, undefined, { sensitivity: 'base' }))
}
