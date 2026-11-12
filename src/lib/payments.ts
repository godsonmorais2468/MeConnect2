import { fmtDate } from './format'
import type { DB, Invoice, Member, PayMethod } from './types'

export const MEMBERSHIP = 'Membership dues'
export const PAY_METHODS: PayMethod[] = ['UPI', 'Cheque', 'Cash']

/** What a mode of pay needs: UPI asks for a transaction number and date, cheque for a cheque number and date, anything else is just saved. */
export const kindOfMode = (name: string): PayMethod => (/upi/i.test(name) ? 'UPI' : /che?que/i.test(name) ? 'Cheque' : 'Cash')

/** The chapter's active modes of pay, by name. A chapter that has not created any yet gets the standard three. */
export function modesOf(db: DB, chapterId: string | undefined): string[] {
  const created = (db.paymentModes || []).filter((m) => m.chapterId === chapterId && m.isActive).map((m) => m.name)
  return created.length ? created : PAY_METHODS
}

/** How a payment was made, as people named it. */
export const modeLabel = (i: Invoice) => i.modeName || i.method || ''

/** What an invoice is for. Plain membership invoices have no request type. */
export const kindOf = (i: Invoice) => i.kind || MEMBERSHIP

/** The extra details a payment carries, by mode: UPI has a transaction ID and date, cheque has a number and date. */
export function modeDetails(i: Invoice): { label: string; value: string }[] {
  if (i.method === 'UPI') return [{ label: 'Transaction ID', value: i.txnId || '-' }, { label: 'Transaction date', value: fmtDate(i.txnDate ?? '') || '-' }]
  if (i.method === 'Cheque') return [{ label: 'Cheque number', value: i.chequeNo || '-' }, { label: 'Cheque date', value: fmtDate(i.chequeDate ?? '') || '-' }]
  return []
}

export interface PaidRow {
  invoice: Invoice
  member: Member
  /** A pay-all payment: the dues it settled, earliest first. `invoice` is then one entry for the whole amount. */
  together?: Invoice[]
}

/** Every paid invoice of a chapter's members, newest first. `withPending` also lists payments waiting to be verified. */
export function paidInChapter(db: DB, chapterId: string, withPending = false): PaidRow[] {
  const members = new Map(db.members.filter((m) => m.chapterId === chapterId).map((m) => [m.id, m]))
  const rows: PaidRow[] = []
  const bundles = new Map<string, Invoice[]>()
  for (const invoice of db.invoices) {
    const member = members.get(invoice.memberId)
    if (!member || !(invoice.status === 'paid' || (withPending && invoice.status === 'pending'))) continue
    if (invoice.payAll && invoice.ref) {
      /* dues paid in one go count as one payment */
      const key = `${invoice.memberId}:${invoice.ref}`
      const list = bundles.get(key)
      if (list) list.push(invoice)
      else bundles.set(key, [invoice])
    } else rows.push({ invoice, member })
  }
  for (const list of bundles.values()) {
    const together = [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    const total = together.reduce((sum, i) => sum + i.amount, 0)
    rows.push({ invoice: { ...together[0], amount: total }, member: members.get(together[0].memberId)!, together })
  }
  return rows.sort((a, b) => (b.invoice.paidAt ?? '').localeCompare(a.invoice.paidAt ?? ''))
}

/** A CSV download of the rows, for the collection report. */
export function toCsv(rows: PaidRow[], chapterName: (id: string) => string) {
  const head = ['Member', 'Mobile', 'Chapter', 'Request type', 'Amount', 'Mode', 'Reference', 'Paid on', 'Receipt']
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const lines = rows.map(({ invoice: i, member: m }) => {
    const ref = i.method === 'UPI' ? i.txnId : i.method === 'Cheque' ? i.chequeNo : ''
    const date = i.method === 'UPI' ? i.txnDate : i.method === 'Cheque' ? i.chequeDate : ''
    return [m.name, m.mobile, chapterName(m.chapterId), kindOf(i), i.amount, i.method ?? '', `${ref ?? ''}${date ? ` (${date})` : ''}`, (i.paidAt ?? '').slice(0, 10), i.ref ?? ''].map(cell).join(',')
  })
  return [head.map(cell).join(','), ...lines].join('\n')
}
