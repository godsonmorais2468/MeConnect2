import { addMonths } from './dues'
import type { Recurrence } from './types'

/** Most dues one recurring request may create for each member. */
export const MAX_OCCURRENCES = 100

export const RECURRENCE_LABEL: Record<Recurrence, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }

function plusDays(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(y, m - 1, d + days)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/**
 * Every date a recurring request falls on, from `from` to `to` (both included).
 * Daily: each day. Weekly: the same weekday as `from`. Monthly: the same day of the month as `from`
 * (a short month uses its last day). Stops one past MAX_OCCURRENCES so callers can tell the range is too long.
 */
export function recurrenceDates(every: Recurrence, from: string, to: string): string[] {
  if (!from || !to || to < from) return []
  const out: string[] = []
  for (let k = 0; out.length <= MAX_OCCURRENCES; k++) {
    const day = every === 'daily' ? plusDays(from, k) : every === 'weekly' ? plusDays(from, 7 * k) : addMonths(from, k)
    if (day > to) break
    out.push(day)
  }
  return out
}
