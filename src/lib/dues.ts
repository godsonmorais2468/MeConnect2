import type { DB, Invoice } from './types'

/** Today as YYYY-MM-DD in local time. */
export const dayOf = (ms: number) => new Date(ms).toLocaleDateString('en-CA')

/** A YYYY-MM-DD date moved forward by whole months. A day that does not exist in the target month falls back to its last day. */
export function addMonths(ymd: string, months: number) {
  const [y, m, d] = ymd.split('-').map(Number)
  const lastDay = new Date(y, m - 1 + months + 1, 0).getDate()
  const t = new Date(y, m - 1 + months, Math.min(d, lastDay))
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export const isOverdue = (inv: Invoice, now: number) => inv.status === 'due' && inv.dueDate !== '' && inv.dueDate < dayOf(now)

/** Earliest due date first; requests without a due date go last. */
export const byDueDate = (a: Invoice, b: Invoice) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')

export const totalOf = (invoices: Invoice[]) => Math.round(invoices.reduce((n, i) => n + i.amount, 0) * 100) / 100

/**
 * What a member still owes on a recurring request: the dues already made, and the dates that have not come yet, whose
 * invoices do not exist until their day (or until they are paid in advance). `today` is YYYY-MM-DD.
 */
export function remainingOnRequest(db: DB, memberId: string, requestId: string, today: string) {
  const request = db.requests.find((r) => r.id === requestId)
  const mine = db.invoices.filter((i) => i.memberId === memberId && i.requestId === requestId)
  const due = mine.filter((i) => i.status === 'due')
  const have = new Set(mine.map((i) => i.dueDate))
  const coming = (request?.recurrence?.dates ?? []).filter((d) => d > today && !have.has(d))
  const total = Math.round((totalOf(due) + (request?.amount ?? 0) * coming.length) * 100) / 100
  return { due, coming, count: due.length + coming.length, total }
}

