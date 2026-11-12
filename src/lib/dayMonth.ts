/**
 * Birthdays and anniversaries are kept as a day and a month only. The server stores a full date, so the year is always
 * this fixed one (a leap year, so 29 February is allowed); it is never shown and never used.
 */
export const HIDDEN_YEAR = 2000

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** How many days a month can have (February counts 29, since the year is not known). */
export const daysIn = (month: number) => new Date(HIDDEN_YEAR, month, 0).getDate()

/** The day and month of a stored date, whatever year it carries. */
export function dayMonthOf(iso: string): { day: number; month: number } | null {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso || '')
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  return month >= 1 && month <= 12 && day >= 1 && day <= daysIn(month) ? { day, month } : null
}

/** The date to store for a day and month. */
export const storeDayMonth = (day: number, month: number) => `${HIDDEN_YEAR}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** A stored date moved to the hidden year, so an older date with a real year loses it when the profile is saved. */
export function withoutYear(iso: string) {
  const d = dayMonthOf(iso)
  return d ? storeDayMonth(d.day, d.month) : ''
}

/** "21 Oct" */
export function fmtDayMonth(iso: string) {
  const d = dayMonthOf(iso)
  return d ? `${d.day} ${MONTHS[d.month - 1].slice(0, 3)}` : ''
}
