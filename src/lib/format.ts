import type { Tone } from './types'

export function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function initials(name: string) {
  return name
    .replace(/^(dr|mr|mrs|ms)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

export function firstName(name: string) {
  return name.replace(/^(dr|mr|mrs|ms)\.?\s+/i, '').split(/\s+/)[0] ?? name
}

const TONES: Tone[] = ['red', 'wine', 'gold', 'green', 'steel', 'navy']

/** The same name always gets the same tile colour. */
export function toneFor(name: string): Tone {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997
  return TONES[h % TONES.length]
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', opts)
}

export function fmtTime(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

/** First letter of a name for the A–Z index; anything else goes under "#". */
export function indexLetter(name: string) {
  const c = name.trim().charAt(0).toUpperCase()
  return c >= 'A' && c <= 'Z' ? c : '#'
}
