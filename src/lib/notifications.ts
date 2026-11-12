import { useSyncExternalStore } from 'react'
import { phaseOf, windowOf } from './attendance'
import { dayOf, isOverdue } from './dues'
import { fmtDate, fmtTime, firstName, inr } from './format'
import { useNow } from './hooks'
import { percent } from './profile'
import { useDB } from './store'
import type { DB, Member, Tone } from './types'
import { wishesFor } from './wishes'

export type NoteKind = 'attendance' | 'meeting' | 'due' | 'wish' | 'profile' | 'poll'

export interface Note {
  id: string
  kind: NoteKind
  tone: Tone
  title: string
  text: string
  /** Where tapping it goes. */
  to: string
  /** Lower comes first. */
  rank: number
  read: boolean
}

/* ---------- which notifications each member has already opened ---------- */

const KEY = 'me-connect:read'
type ReadMap = Record<string, string[]>

function load(): ReadMap {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as ReadMap
  } catch {
    return {}
  }
}

let readMap: ReadMap = load()
const listeners = new Set<() => void>()

function save(next: ReadMap) {
  readMap = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* blocked storage — read marks last for this tab only */
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function markRead(memberId: string, ids: string[]) {
  const seen = new Set(readMap[memberId] ?? [])
  ids.forEach((id) => seen.add(id))
  save({ ...readMap, [memberId]: [...seen] })
}

export const clearRead = () => save({})

/* ---------- building the list from what the member can see ---------- */

function build(db: DB, member: Member, now: number): Omit<Note, 'read'>[] {
  const out: Omit<Note, 'read'>[] = []

  for (const m of db.meetings.filter((x) => x.chapterId === member.chapterId)) {
    const phase = phaseOf(m, now)
    const mark = db.attendance.find((a) => a.meetingId === m.id && a.memberId === member.id)
    const startsAt = windowOf(m).startsAt
    if (phase === 'open' && !mark) {
      out.push({
        id: `att-${m.id}`,
        kind: 'attendance',
        tone: 'green',
        title: 'Attendance is open',
        text: `${m.title} · ${m.mode === 'online' ? 'Mark your attendance now.' : 'Scan the QR code or use your location.'}`,
        to: '/attendance',
        rank: 0,
      })
    } else if (phase === 'upcoming' && startsAt - now < 24 * 3_600_000) {
      out.push({
        id: `meet-${m.id}`,
        kind: 'meeting',
        tone: 'navy',
        title: 'Meeting coming up',
        text: `${m.title} · ${fmtDate(m.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })}, ${fmtTime(m.startsAt)}`,
        to: '/attendance',
        rank: 4,
      })
    }
    if (mark && now - new Date(mark.at).getTime() < 24 * 3_600_000) {
      out.push({ id: `marked-${mark.id}`, kind: 'attendance', tone: 'green', title: 'Attendance marked', text: `${m.title} · ${fmtTime(mark.at)}`, to: '/attendance', rank: 5 })
    }
  }

  for (const inv of db.invoices.filter((i) => i.memberId === member.id && i.status === 'due')) {
    const late = isOverdue(inv, now)
    out.push({
      id: `due-${inv.id}`,
      kind: 'due',
      tone: late ? 'red' : 'gold',
      title: late ? 'Payment overdue' : 'Payment due',
      text: inv.dueDate ? `${inv.label} · ${inr(inv.amount)}, due ${fmtDate(inv.dueDate)}` : `${inv.label} · ${inr(inv.amount)}`,
      to: '/dues',
      rank: late ? 1 : 3,
    })
  }

  for (const poll of db.polls.filter((p) => p.chapterId === member.chapterId && !p.closed)) {
    if (db.votes.some((v) => v.pollId === poll.id && v.memberId === member.id)) continue
    out.push({ id: `poll-${poll.id}`, kind: 'poll', tone: 'green', title: 'New poll: your response is needed', text: poll.question, to: '/rsvp', rank: 2 })
  }

  const today = dayOf(now)
  const mates = db.members.filter((m) => m.chapterId === member.chapterId)
  for (const w of wishesFor(mates, now).filter((x) => x.daysAway === 0)) {
    const mine = w.member.id === member.id
    out.push({
      id: `wish-${w.kind}-${w.member.id}-${today}`,
      kind: 'wish',
      tone: 'navy',
      title: mine ? `Happy ${w.kind}, ${firstName(member.name)}!` : `${w.member.name}’s ${w.kind} today`,
      text: mine ? 'Your chapter wishes you well.' : 'Send your wishes.',
      to: '/wishes',
      rank: 2,
    })
  }

  const pct = percent(member)
  if (pct < 100) {
    out.push({ id: 'profile', kind: 'profile', tone: 'steel', title: 'Complete your profile', text: `${pct}% done. Add the rest so members can reach you.`, to: '/profile', rank: 6 })
  }

  return out.sort((a, b) => a.rank - b.rank)
}

/** The signed-in member's notifications, with whether each has been opened. */
export function useNotifications(member: Member | null): Note[] {
  const db = useDB()
  const now = useNow(60_000)
  const seen = useSyncExternalStore(subscribe, () => readMap)
  if (!member) return []
  const read = new Set(seen[member.id] ?? [])
  return build(db, member, now).map((n) => ({ ...n, read: read.has(n.id) }))
}
