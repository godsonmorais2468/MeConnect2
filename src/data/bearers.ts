import { Award, ClipboardList, Crown, Handshake, Rocket, Wallet } from 'lucide-react'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'
import type { Tone } from '../lib/types'

export interface BearerGroup {
  key: string
  title: string
  icon: ComponentType<LucideProps>
  tone: Tone
  /** Decides whether a member's designation belongs to this group. */
  match: (designation: string) => boolean
}

/* ---------- loose matching ----------
   A designation is free text typed by the region admin ("Vice-President", "vice  president", "V.P.",
   "Vice Precident", "Co-ordinator"...). It is cut into lower-case words, and a role is recognised when a
   word is the role's word, give or take a typo. Each designation lands in one group only (the first that fits). */

/** Lower-case words; any punctuation, digits or extra spaces just separate words. */
const words = (d: string) => d.toLowerCase().split(/[^a-z]+/).filter(Boolean)

/** Edit distance between two short words (insert, delete, change, or swap neighbours). */
function distance(a: string, b: string) {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** Is `word` the target word, allowing one typo (two for long words)? */
const near = (word: string, target: string) => distance(word, target) <= (target.length >= 8 ? 2 : target.length >= 5 ? 1 : 0)

/** Does the designation contain the word, even if split ("co ordinator") or slightly misspelt? */
function has(d: string, target: string) {
  const w = words(d)
  return w.some((x) => near(x, target)) || w.join('').includes(target)
}

/* "resident" is one letter from "president" but a different word */
const hasPresident = (d: string) => words(d).some((x) => x !== 'resident' && near(x, 'president')) || words(d).join('').includes('president') || words(d).some((x) => x === 'pres')
const hasVice = (d: string) => words(d).some((x) => x === 'vice' || x === 'vise') || words(d).join('').includes('vicepres')

/** The group key a designation belongs to, or '' when it is not an office-bearer role. */
export function bearerKeyOf(designation: string) {
  const w = words(designation)
  if (w.length === 0) return ''
  if (hasVice(designation) && hasPresident(designation)) return 'vice-president'
  if (w.includes('vp') || w.join('') === 'vp') return 'vice-president'
  if (hasPresident(designation) && !w.some((x) => ['assistant', 'asst', 'deputy', 'past', 'ex', 'former'].includes(x))) return 'president'
  if (has(designation, 'secretary') || has(designation, 'treasurer') || w.some((x) => x === 'secy' || x === 'treas')) return 'secretary-treasurer'
  if (has(designation, 'ambassador')) return 'ambassadors'
  if (has(designation, 'launch')) return 'launch-team'
  if (has(designation, 'coordinator') || (w.includes('visitor') && w.includes('host'))) return 'coordinators'
  return ''
}

/** Shown in this order on the Office Bearers page. */
export const BEARER_GROUPS: BearerGroup[] = [
  {
    key: 'president',
    title: 'President',
    icon: Crown,
    tone: 'red',
    match: (d) => bearerKeyOf(d) === 'president',
  },
  {
    key: 'vice-president',
    title: 'Vice President',
    icon: Award,
    tone: 'gold',
    match: (d) => bearerKeyOf(d) === 'vice-president',
  },
  {
    key: 'secretary-treasurer',
    title: 'Secretary / Treasurer',
    icon: Wallet,
    tone: 'navy',
    match: (d) => bearerKeyOf(d) === 'secretary-treasurer',
  },
  {
    key: 'ambassadors',
    title: 'Ambassadors',
    icon: Handshake,
    tone: 'green',
    match: (d) => bearerKeyOf(d) === 'ambassadors',
  },
  {
    key: 'launch-team',
    title: 'Launch Team',
    icon: Rocket,
    tone: 'wine',
    match: (d) => bearerKeyOf(d) === 'launch-team',
  },
  {
    key: 'coordinators',
    title: 'Coordinators',
    icon: ClipboardList,
    tone: 'steel',
    match: (d) => bearerKeyOf(d) === 'coordinators',
  },
]
