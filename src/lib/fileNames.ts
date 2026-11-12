import { getDB } from './store'
import { yearFor } from './vouchers'

/** Keeps letters and digits; every other run of characters becomes one dash, so a chapter name is safe in a file name. */
export const safeName = (text: string) => text.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/**
 * Splits a document number such as REC-00012 into its prefix (REC) and running number (00012).
 * An older number like INV-2026-00001 has the year in its prefix; the year is dropped because the file name has its own.
 */
export function splitNumber(number: string): { prefix: string; seq: string } {
  const i = number.lastIndexOf('-')
  if (i < 0) return { prefix: '', seq: number }
  return { prefix: number.slice(0, i).replace(/-\d{4}$/, ''), seq: number.slice(i + 1) }
}

/**
 * The financial year to print in a file name. It is the chapter's financial year that covers the date; failing that
 * the chapter's current one; failing that the Indian financial year (April to March) the date falls in, e.g. 2026-2027.
 */
export function financialYearLabel(chapterId: string, date: string): string {
  const db = getDB()
  const day = (date || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
  const covering = yearFor(db, chapterId, day)
  if (covering) return safeName(covering.title)
  const current = (db.financialYears || []).find((y) => y.chapterId === chapterId && y.isCurrent)
  if (current) return safeName(current.title)
  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

/** ME-CONNECT_{Chapter}_{Prefix}_{FinancialYear}_{Number}.{ext}, for invoices, receipts and vouchers. */
export function printableName(number: string, chapterName: string | undefined, financialYear: string, ext = 'pdf') {
  const { prefix, seq } = splitNumber(number)
  return ['ME-CONNECT', safeName(chapterName || 'Chapter'), prefix, financialYear, seq].filter(Boolean).join('_') + `.${ext}`
}
