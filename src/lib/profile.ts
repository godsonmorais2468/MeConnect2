import type { Member } from './types'

export interface CheckItem {
  key: string
  label: string
  done: boolean
}

/** What counts toward "% profile completed". Name and mobile are always filled, so they are not listed. */
export function checklist(m: Member): CheckItem[] {
  const p = m.profile
  const items: CheckItem[] = [
    { key: 'photo', label: 'Profile photo', done: !!m.photo },
    { key: 'designation', label: 'Designation', done: !!m.designation },
    { key: 'organisation', label: 'Company name', done: !!m.organisation.trim() },
    { key: 'category', label: 'Category', done: !!m.category.trim() },
    { key: 'joined', label: 'Date of joining', done: !!p.dateOfJoining },
    { key: 'email', label: 'Email', done: !!p.email.trim() },
    { key: 'website', label: 'Website', done: !!p.website.trim() },
    { key: 'social', label: 'Social media', done: !!p.social.trim() },
    { key: 'dob', label: 'Birthday', done: !!p.dob },
    { key: 'married', label: 'Marital status', done: p.married !== '' },
  ]
  if (p.married === 'yes') {
    items.push(
      { key: 'anniversary', label: 'Anniversary', done: !!p.anniversary },
      { key: 'spouse', label: 'Spouse name', done: !!p.spouse.trim() },
    )
  }
  return items
}

const ALWAYS_FILLED = 2 // name + mobile

export function percent(m: Member) {
  const items = checklist(m)
  const done = items.filter((i) => i.done).length + ALWAYS_FILLED
  return Math.round((done / (items.length + ALWAYS_FILLED)) * 100)
}
