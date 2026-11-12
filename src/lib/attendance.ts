import type { Meeting } from './types'

/** The scanner and "mark attendance" open this long before the meeting starts. */
export const OPENS_BEFORE_MIN = 30
/** The QR code changes this often so a photo of it cannot be shared around. */
export const QR_STEP_MS = 2_000

const MIN = 60_000

export type Phase = 'upcoming' | 'open' | 'ended'

export function windowOf(m: Meeting) {
  const startsAt = new Date(m.startsAt).getTime()
  return { opensAt: startsAt - OPENS_BEFORE_MIN * MIN, startsAt, endsAt: startsAt + m.durationMin * MIN }
}

export function phaseOf(m: Meeting, now: number): Phase {
  const w = windowOf(m)
  if (now < w.opensAt) return 'upcoming'
  return now <= w.endsAt ? 'open' : 'ended'
}

/** The meeting people care about right now: the open one, else the next, else the latest. */
export function currentMeeting(meetings: Meeting[], now: number): Meeting | undefined {
  const byStart = [...meetings].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  return (
    byStart.find((m) => phaseOf(m, now) === 'open') ??
    byStart.find((m) => phaseOf(m, now) === 'upcoming') ??
    byStart[byStart.length - 1]
  )
}

/** Straight-line distance between two coordinates, in metres (haversine). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/* ---------- rotating QR code ---------- */

function codeForStep(meetingId: string, step: number) {
  let h = 5381
  for (const ch of `bni-att:${meetingId}:${step}`) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0
  return h.toString(36).toUpperCase().padStart(6, '0').slice(-6)
}

/** The code the coordinator's screen shows right now. */
export const qrCodeFor = (meetingId: string, now: number) => codeForStep(meetingId, Math.floor(now / QR_STEP_MS))

/** Accepts the current code and the one before it, so a scan right at the switch still works. */
export function codeValid(meetingId: string, code: string, now: number) {
  const step = Math.floor(now / QR_STEP_MS)
  const given = code.trim().toUpperCase()
  return given === codeForStep(meetingId, step) || given === codeForStep(meetingId, step - 1)
}

export const qrPayload = (meetingId: string, code: string) => `BNI-ATT|${meetingId}|${code}`

/** Reads a scanned QR, or a code typed by hand. */
export function parseCode(text: string, meetingId: string): string | null {
  const t = text.trim()
  if (t.startsWith('BNI-ATT|')) {
    const [, id, code] = t.split('|')
    return id === meetingId && code ? code : null
  }
  return /^[A-Za-z0-9]{6}$/.test(t) ? t : null
}

export const isCoordinator = (designation: string) => /attendance coordinator/i.test(designation)
