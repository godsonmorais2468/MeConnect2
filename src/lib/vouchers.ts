import type { DB, FinancialYear, VoucherKind } from './types'

const tailOf = (value: string | undefined, prefix: string) => {
  if (!value?.startsWith(`${prefix}-`)) return NaN
  const tail = value.slice(prefix.length + 1)
  return /^\d+$/.test(tail) ? Number(tail) : NaN
}

/** The financial year of a chapter that covers a date (the current one first). */
export function yearFor(db: DB, chapterId: string, date: string): FinancialYear | undefined {
  const years = (db.financialYears || []).filter((y) => y.chapterId === chapterId && y.startDate <= date && date <= y.endDate)
  return years.find((y) => y.isCurrent) ?? years[0]
}

/** The highest receipt number the members' payments in a chapter have used with this prefix. */
export function receiptFloor(db: DB, chapterId: string, prefix: string): number {
  const inChapter = new Set(db.members.filter((m) => m.chapterId === chapterId).map((m) => m.id))
  let top = 0
  for (const i of db.invoices) {
    if (!inChapter.has(i.memberId)) continue
    const tail = tailOf(i.ref, prefix)
    if (Number.isFinite(tail) && tail > top) top = tail
  }
  /* receipts given to visitors who paid when registering are on the same sequence */
  for (const v of db.visitorPayments || []) {
    if (v.chapterId !== chapterId) continue
    const tail = tailOf(v.receipt, prefix)
    if (Number.isFinite(tail) && tail > top) top = tail
  }
  return top
}

/**
 * The number the next voucher will get, as the financial year settings give it. This is only a preview: the server
 * assigns the real number when the voucher is saved. Receipt vouchers continue the members' receipt numbers.
 */
export function previewNumber(db: DB, chapterId: string, kind: VoucherKind, date: string): { year?: FinancialYear; number: string } {
  const year = yearFor(db, chapterId, date)
  if (!year) return { number: '' }
  const prefix = (kind === 'receipt' ? year.receiptPrefix : year.voucherPrefix) || (kind === 'receipt' ? 'REC' : 'VOU')
  const start = (kind === 'receipt' ? year.receiptStartNumber : year.voucherStartNumber) || 1
  let top = Math.max(start - 1, kind === 'receipt' ? receiptFloor(db, chapterId, prefix) : 0)
  for (const v of db.vouchers || []) {
    if (v.chapterId !== chapterId) continue
    const tail = tailOf(v.number, prefix)
    if (Number.isFinite(tail) && tail > top) top = tail
  }
  return { year, number: `${prefix}-${String(top + 1).padStart(5, '0')}` }
}
