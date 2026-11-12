import { financialYearLabel, printableName, safeName } from './fileNames'
import { fmtDate } from './format'
import { getPdfLogo } from './pdfLogo'
import { preparedByLines } from './preparedBy'
import type { Chapter, Invoice, Member, Region, Voucher, VisitorPayment } from './types'

/** What the invoice shows. */
export interface InvoiceInfo {
  invoice: Invoice
  member: Member
  chapter: Chapter | null
  region: Region | null
}

export const invoiceNo = (i: Invoice) => i.no || i.id

/** The receipt number printed on a paid invoice. */
export const receiptNo = (i: Invoice) => i.ref || i.id

/* The PDFs are drawn by hand so no library is needed. They use the built-in Helvetica fonts, which have no rupee sign, so amounts read "Rs.".
   Every printable is A5 portrait: 148 x 210 mm. */
const A5 = { w: 420, h: 595 }
const LEFT = 30
const RIGHT = A5.w - 30
const BAND_Y = 527
const RED: [number, number, number] = [0.06, 0.18, 0.17]
const INK: [number, number, number] = [0.078, 0.125, 0.122]
const GREY: [number, number, number] = [0.42, 0.46, 0.52]
const GREEN: [number, number, number] = [0.05, 0.48, 0.33]
const WHITE: [number, number, number] = [1, 1, 1]
const RULE: [number, number, number] = [0.88, 0.89, 0.91]
const WASH_RED: [number, number, number] = [0.93, 0.95, 0.94]
const WASH_GREEN: [number, number, number] = [0.93, 0.97, 0.95]

const plain = (s: string) =>
  String(s ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/₹/g, 'Rs. ')
    .replace(/[·•]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E\n]/g, '?')

const esc = (s: string) => plain(s).replace(/\n/g, ' ').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
const money = (n: number) => `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Standard Type 1 Helvetica and Helvetica-Bold font metrics (1/1000 em)
const HELVETICA_WIDTHS: Record<number, number> = {
  32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191,
  40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556, 56: 556, 57: 556,
  58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556, 64: 1015,
  65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778, 72: 722, 73: 278, 74: 500,
  75: 667, 76: 556, 77: 833, 78: 722, 79: 778, 80: 667, 81: 778, 82: 722, 83: 667, 84: 611,
  85: 722, 86: 667, 87: 944, 88: 667, 89: 667, 90: 611,
  91: 278, 92: 278, 93: 278, 94: 469, 95: 556, 96: 333,
  97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556, 104: 556, 105: 222, 106: 222,
  107: 500, 108: 222, 109: 833, 110: 556, 111: 556, 112: 556, 113: 556, 114: 333, 115: 500, 116: 278,
  117: 556, 118: 500, 119: 722, 120: 500, 121: 500, 122: 500,
  123: 334, 124: 260, 125: 334, 126: 584,
}

const HELVETICA_BOLD_WIDTHS: Record<number, number> = {
  32: 278, 33: 333, 34: 474, 35: 556, 36: 556, 37: 889, 38: 722, 39: 238,
  40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556, 56: 556, 57: 556,
  58: 333, 59: 333, 60: 584, 61: 584, 62: 584, 63: 611, 64: 975,
  65: 722, 66: 722, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778, 72: 722, 73: 278, 74: 556,
  75: 722, 76: 611, 77: 833, 78: 722, 79: 778, 80: 667, 81: 778, 82: 722, 83: 667, 84: 667,
  85: 722, 86: 667, 87: 944, 88: 667, 89: 667, 90: 611,
  91: 333, 92: 278, 93: 333, 94: 584, 95: 556, 96: 333,
  97: 556, 98: 611, 99: 556, 100: 611, 101: 556, 102: 333, 103: 611, 104: 611, 105: 278, 106: 278,
  107: 556, 108: 278, 109: 889, 110: 611, 111: 611, 112: 611, 113: 611, 114: 389, 115: 556, 116: 333,
  117: 611, 118: 556, 119: 778, 120: 556, 121: 556, 122: 500,
  123: 389, 124: 280, 125: 389, 126: 584,
}

function textWidth(s: string, size: number, bold: boolean): number {
  const p = plain(s)
  const map = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS
  let units = 0
  for (let i = 0; i < p.length; i++) {
    const code = p.charCodeAt(i)
    units += map[code] ?? (bold ? 600 : 550)
  }
  return (units / 1000) * size
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 3)}...` : s)

function wrap(text: string, max: number) {
  const lines: string[] = []
  let line = ''
  for (const word of plain(text).split(/\s+/).filter(Boolean)) {
    if ((line + ' ' + word).trim().length > max) {
      if (line) lines.push(line)
      line = word
    } else line = (line + ' ' + word).trim()
  }
  if (line) lines.push(line)
  return lines
}

// Convert numerical amount to Indian currency words
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function convertThreeDigits(num: number): string {
  let str = ''
  if (num >= 100) {
    str += ONES[Math.floor(num / 100)] + ' Hundred '
    num %= 100
  }
  if (num >= 20) {
    str += TENS[Math.floor(num / 10)] + (num % 10 ? ' ' + ONES[num % 10] : '') + ' '
  } else if (num > 0) {
    str += ONES[num] + ' '
  }
  return str.trim()
}

export function amountInWords(amount: number): string {
  if (!amount || isNaN(amount) || amount === 0) return 'Rupees Zero Only'

  const absAmount = Math.abs(amount)
  let whole = Math.floor(absAmount)
  const paise = Math.round((absAmount - whole) * 100)

  let words = ''

  const crores = Math.floor(whole / 10000000)
  whole %= 10000000

  const lakhs = Math.floor(whole / 100000)
  whole %= 100000

  const thousands = Math.floor(whole / 1000)
  whole %= 1000

  const hundreds = whole

  if (crores > 0) {
    words += convertThreeDigits(crores) + ' Crore '
  }
  if (lakhs > 0) {
    words += convertThreeDigits(lakhs) + ' Lakh '
  }
  if (thousands > 0) {
    words += convertThreeDigits(thousands) + ' Thousand '
  }
  if (hundreds > 0) {
    words += convertThreeDigits(hundreds) + ' '
  }

  words = words.trim()
  if (!words) words = 'Zero'

  let result = 'Rupees ' + words

  if (paise > 0) {
    result += ' and ' + convertThreeDigits(paise) + ' Paise'
  }

  return result + ' Only'
}

class Page {
  ops: string[] = []

  rect(x: number, y: number, w: number, h: number, c: [number, number, number]) {
    this.ops.push(`${c.join(' ')} rg ${x} ${y} ${w} ${h} re f`)
  }

  text(s: string, x: number, y: number, size = 10, opts: { bold?: boolean; color?: [number, number, number]; right?: boolean } = {}) {
    const { bold = false, color = INK, right = false } = opts
    const left = right ? x - textWidth(s, size, bold) : x
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color.join(' ')} rg ${left.toFixed(1)} ${y} Td (${esc(s)}) Tj ET`)
  }

  /** The ME-CONNECT logo (the image assemblePdf adds) with rounded corners. */
  logo(x: number, y: number, w: number, h: number) {
    const r = 5
    const k = 0.5523 * r
    const x2 = x + w
    const y2 = y + h
    this.ops.push(
      [
        'q',
        `${x + r} ${y} m ${x2 - r} ${y} l ${x2 - r + k} ${y} ${x2} ${y + r - k} ${x2} ${y + r} c`,
        `${x2} ${y2 - r} l ${x2} ${y2 - r + k} ${x2 - r + k} ${y2} ${x2 - r} ${y2} c`,
        `${x + r} ${y2} l ${x + r - k} ${y2} ${x} ${y2 - r + k} ${x} ${y2 - r} c`,
        `${x} ${y + r} l ${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} c`,
        `W n ${w} 0 0 ${h} ${x} ${y} cm /Im1 Do Q`,
      ].join('\n'),
    )
  }
}

/** The coloured band across the top: logo, brand and chapter on the left, the document's name on the right. */
function band(p: Page, color: [number, number, number], title: string, chapter: Chapter | null, region: Region | null, sub?: string) {
  p.rect(0, BAND_Y, A5.w, A5.h - BAND_Y, color)
  /* the ME-CONNECT logo sits at the left once it has loaded; the name and chapter move across to make room */
  const logo = getPdfLogo()
  if (logo) p.logo(LEFT, 549, 64, 26)
  const x0 = logo ? LEFT + 74 : LEFT
  p.text('ME-CONNECT', x0, 562, logo ? 15 : 19, { bold: true, color: WHITE })
  p.text(clip(`${chapter?.name ?? ''}${region ? ` - ${region.name}` : ''}`, logo ? 28 : 36), x0, 546, logo ? 8.5 : 9, { color: WHITE })
  p.text(title, RIGHT, sub ? 562 : 557, logo ? 15 : 17, { bold: true, color: WHITE, right: true })
  if (sub) p.text(sub, RIGHT, 546, 9, { color: WHITE, right: true })
}

/** "Prepared by : {Name}" and "Secretary/Treasurer" under it, right-aligned to the page margin, level with Payment details on the left. */
function preparedBy(p: Page, chapterId: string, top: number) {
  let y = top
  for (const line of preparedByLines(chapterId).flatMap((l) => wrap(l, 30))) {
    p.text(line, RIGHT, y, 9, { bold: true, right: true })
    y -= 12
  }
}

/** Highlighted, professional footer matching ME-CONNECT App 3.0 reports */
function footer(p: Page, disclaimer: string, pageNum?: string) {
  p.rect(LEFT, 12, RIGHT - LEFT, 20, [0.965, 0.972, 0.982])
  p.rect(LEFT, 32, RIGHT - LEFT, 0.75, [0.86, 0.88, 0.91])
  p.rect(LEFT, 12, 2.5, 20, RED)

  let curX = LEFT + 7
  p.text('ME-CONNECT App 3.0', curX, 18, 7, { bold: true, color: INK })
  curX += textWidth('ME-CONNECT App 3.0', 7, true)

  p.text(' - Powered By ', curX, 18, 7, { color: GREY })
  curX += textWidth(' - Powered By ', 7, false)

  p.text('www.geosysitsolutions.com', curX, 18, 7, { bold: true, color: RED })

  if (pageNum) {
    p.text(pageNum, RIGHT - 8, 18, 7, { bold: true, color: INK, right: true })
  }

  p.text(disclaimer, (A5.w - textWidth(disclaimer, 6.8, false)) / 2, 36, 6.8, { color: GREY })
}

/** Builds the invoice as a one-page A5 PDF. */
export function buildInvoicePdf({ invoice: i, member: m, chapter, region }: InvoiceInfo): Blob {
  const p = new Page()
  const paid = i.status === 'paid'
  const kind = i.kind || 'Membership dues'

  band(p, RED, 'INVOICE', chapter, region)

  // invoice facts
  p.text('INVOICE NO.', LEFT, 500, 7, { color: GREY, bold: true })
  p.text(invoiceNo(i), LEFT, 487, 11, { bold: true })
  p.text('DATE', 165, 500, 7, { color: GREY, bold: true })
  p.text(fmtDate(i.issuedAt || i.dueDate || i.paidAt || '') || '-', 165, 487, 10, { bold: true })
  p.text('DUE DATE', 262, 500, 7, { color: GREY, bold: true })
  p.text(i.dueDate ? fmtDate(i.dueDate) : 'No due date', 262, 487, 10, { bold: true, color: i.dueDate && !paid ? RED : INK })
  p.text(paid ? 'PAID' : 'DUE', RIGHT, 487, 15, { bold: true, color: paid ? GREEN : RED, right: true })
  p.rect(LEFT, 474, RIGHT - LEFT, 1, RULE)

  // parties
  p.text('BILLED TO', LEFT, 456, 7, { color: GREY, bold: true })
  p.text(clip(m.name, 28), LEFT, 442, 11, { bold: true })
  p.text(`Mobile: ${m.mobile}`, LEFT, 429, 9, { color: GREY })
  let y = 417
  if (m.organisation) {
    p.text(clip(m.organisation, 34), LEFT, y, 9, { color: GREY })
    y -= 12
  }
  p.text(clip(`${chapter?.name ?? ''}${region ? `, ${region.name}` : ''}`, 34), LEFT, y, 9, { color: GREY })

  p.text('PAY TO', 235, 456, 7, { color: GREY, bold: true })
  p.text(clip(chapter?.upiName || chapter?.name || 'ME-CONNECT', 24), 235, 442, 11, { bold: true })
  if (chapter?.upiId) p.text(clip(`UPI ID: ${chapter.upiId}`, 30), 235, 429, 9, { color: GREY })

  // line items
  p.rect(LEFT, 366, RIGHT - LEFT, 22, WASH_RED)
  p.text('DESCRIPTION', LEFT + 10, 373, 7, { color: GREY, bold: true })
  p.text('AMOUNT', RIGHT - 10, 373, 7, { color: GREY, bold: true, right: true })
  p.text(clip(i.label, 40), LEFT + 10, 351, 10, { bold: true })
  let row = 338
  if (i.label !== kind) {
    p.text(clip(kind, 50), LEFT + 10, row, 8, { color: GREY })
    row -= 11
  }
  for (const line of wrap(i.description ?? '', 58)) {
    p.text(line, LEFT + 10, row, 8, { color: GREY })
    row -= 11
  }
  p.text(money(i.amount), RIGHT - 10, 351, 10, { bold: true, right: true })

  const totalY = row - 16
  p.rect(LEFT, totalY + 13, RIGHT - LEFT, 1, RULE)
  p.text('Total', RIGHT - 110, totalY, 10, { bold: true, right: true })
  p.text(money(i.amount), RIGHT - 10, totalY, 12, { bold: true, right: true })

  // Amount in words highlighted card
  const wordsY = totalY - 17
  p.rect(LEFT, wordsY - 4, RIGHT - LEFT, 17, WASH_RED)
  p.rect(LEFT, wordsY - 4, RIGHT - LEFT, 0.5, RULE)
  p.rect(LEFT, wordsY + 13, RIGHT - LEFT, 0.5, RULE)
  p.rect(LEFT, wordsY - 4, 3, 17, RED)
  p.text('Amount in Words:', LEFT + 8, wordsY + 2, 7.5, { bold: true, color: RED })
  p.text(clip(amountInWords(i.amount), 56), LEFT + 78, wordsY + 2, 7.5, { bold: true, color: INK })

  // payment details on the left, who prepared it on the right
  const detailsY = wordsY - 24
  if (paid) {
    p.text('PAYMENT DETAILS', LEFT, detailsY, 7, { color: GREY, bold: true })
    let d = detailsY - 14
    const facts: [string, string][] = [['Paid on', fmtDate(i.paidAt ?? '') || '-'], ['Mode', i.modeName || i.method || '-'], ['Receipt no.', i.ref ?? '-']]
    if (i.method === 'UPI') facts.push(['Transaction ID', i.txnId || '-'])
    if (i.method === 'Cheque') facts.push(['Cheque number', i.chequeNo || '-'], ['Cheque date', fmtDate(i.chequeDate ?? '') || '-'])
    for (const [k, v] of facts) {
      p.text(k, LEFT, d, 8.5, { color: GREY })
      p.text(clip(v, 22), LEFT + 85, d, 8.5, { bold: true })
      d -= 13
    }
  }
  preparedBy(p, m.chapterId, detailsY)

  footer(p, 'This is a computer-generated invoice and needs no physical signature.')
  return assemblePdf([p])
}

/** Saves the invoice as a PDF named ME-CONNECT_{Chapter}_{Prefix}_{FinancialYear}_{Number}.pdf. */
export function downloadInvoice(info: InvoiceInfo) {
  const url = URL.createObjectURL(buildInvoicePdf(info))
  const a = document.createElement('a')
  a.href = url
  a.download = printableName(invoiceNo(info.invoice), info.chapter?.name, financialYearLabel(info.member.chapterId, info.invoice.issuedAt || info.invoice.dueDate || info.invoice.paidAt || ''))
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Builds the receipt for one verified payment as a one-page A5 PDF. */
export function buildReceiptPdf({ invoice: i, member: m, chapter, region }: InvoiceInfo): Blob {
  const p = new Page()
  const kind = i.kind || 'Membership dues'

  band(p, GREEN, 'RECEIPT', chapter, region)

  p.text('RECEIPT NO.', LEFT, 500, 7, { color: GREY, bold: true })
  p.text(receiptNo(i), LEFT, 487, 11, { bold: true })
  p.text('DATE', 165, 500, 7, { color: GREY, bold: true })
  p.text(fmtDate(i.verifiedAt || i.paidAt || '') || '-', 165, 487, 10, { bold: true })
  p.text('INVOICE NO.', 262, 500, 7, { color: GREY, bold: true })
  p.text(invoiceNo(i), 262, 487, 9.5, { bold: true })
  p.text('PAID', RIGHT, 487, 15, { bold: true, color: GREEN, right: true })
  p.rect(LEFT, 474, RIGHT - LEFT, 1, RULE)

  p.text('RECEIVED FROM', LEFT, 456, 7, { color: GREY, bold: true })
  p.text(clip(m.name, 28), LEFT, 442, 11, { bold: true })
  p.text(`Mobile: ${m.mobile}`, LEFT, 429, 9, { color: GREY })
  let y = 417
  if (m.organisation) {
    p.text(clip(m.organisation, 34), LEFT, y, 9, { color: GREY })
    y -= 12
  }
  p.text(clip(`${chapter?.name ?? ''}${region ? `, ${region.name}` : ''}`, 34), LEFT, y, 9, { color: GREY })

  p.text('RECEIVED BY', RIGHT, 456, 7, { color: GREY, bold: true, right: true })
  p.text(clip(chapter?.upiName || chapter?.name || 'ME-CONNECT', 24), RIGHT, 442, 11, { bold: true, right: true })

  p.rect(LEFT, 366, RIGHT - LEFT, 22, WASH_GREEN)
  p.text('PAYMENT FOR', LEFT + 10, 373, 7, { color: GREY, bold: true })
  p.text('AMOUNT', RIGHT - 10, 373, 7, { color: GREY, bold: true, right: true })
  p.text(clip(i.label, 40), LEFT + 10, 351, 10, { bold: true })
  let row = 338
  if (i.label !== kind) {
    p.text(clip(kind, 50), LEFT + 10, row, 8, { color: GREY })
    row -= 11
  }
  for (const line of wrap(i.description ?? '', 58)) {
    p.text(line, LEFT + 10, row, 8, { color: GREY })
    row -= 11
  }
  p.text(money(i.amount), RIGHT - 10, 351, 10, { bold: true, right: true })

  const totalY = row - 16
  p.rect(LEFT, totalY + 13, RIGHT - LEFT, 1, RULE)
  // the label sits right beside the figure, and the words below end on the same right edge, so the three read as one block
  const received = money(i.amount)
  p.text(received, RIGHT - 10, totalY, 12, { bold: true, color: GREEN, right: true })
  p.text('Amount received', RIGHT - 10 - textWidth(received, 12, true) - 10, totalY, 10, { bold: true, right: true })

  // The amount in words, right-aligned in brackets under the total, as on the reports
  const wordsY = totalY - 16
  p.text(`(${clip(amountInWords(i.amount), 70)})`, RIGHT - 10, wordsY, 8.5, { bold: true, color: INK, right: true })

  const detailsY = wordsY - 26
  p.text('PAYMENT DETAILS', LEFT, detailsY, 7, { color: GREY, bold: true })
  let d = detailsY - 14
  const facts: [string, string][] = [['Paid on', fmtDate(i.paidAt ?? '') || '-'], ['Mode', i.modeName || i.method || '-']]
  if (i.method === 'UPI') facts.push(['Transaction number', i.txnId || '-'])
  if (i.method === 'Cheque') facts.push(['Cheque number', i.chequeNo || '-'], ['Cheque date', fmtDate(i.chequeDate ?? '') || '-'])
  if (i.verifiedAt) facts.push(['Verified on', fmtDate(i.verifiedAt)])
  for (const [k, v] of facts) {
    p.text(k, LEFT, d, 8.5, { color: GREY })
    p.text(clip(v, 22), LEFT + 100, d, 8.5, { bold: true })
    d -= 13
  }
  // lower than the Payment details heading, with clear space under the total
  preparedBy(p, m.chapterId, detailsY - 44)

  footer(p, 'This is a computer-generated receipt and needs no physical signature.')
  return assemblePdf([p])
}

/** Saves the receipt as a PDF named ME-CONNECT_{Chapter}_{Prefix}_{FinancialYear}_{Number}.pdf. */
export function downloadReceipt(info: InvoiceInfo) {
  const url = URL.createObjectURL(buildReceiptPdf(info))
  const a = document.createElement('a')
  a.href = url
  a.download = printableName(receiptNo(info.invoice), info.chapter?.name, financialYearLabel(info.member.chapterId, info.invoice.verifiedAt || info.invoice.paidAt || ''))
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** What a voucher shows. */
export interface VoucherInfo {
  voucher: Voucher
  chapter: Chapter | null
  region: Region | null
}

/** Builds a payment voucher (expense) or a receipt voucher (income) as a one-page A5 PDF. */
export function buildVoucherPdf({ voucher: v, chapter, region }: VoucherInfo): Blob {
  const p = new Page()
  const payment = v.kind === 'payment'
  const color = payment ? RED : GREEN

  band(p, color, payment ? 'PAYMENT VOUCHER' : 'RECEIPT VOUCHER', chapter, region, payment ? 'Expense' : 'Income')

  p.text(payment ? 'VOUCHER NO.' : 'RECEIPT NO.', LEFT, 500, 7, { color: GREY, bold: true })
  p.text(v.number, LEFT, 487, 11, { bold: true })
  p.text('DATE', 165, 500, 7, { color: GREY, bold: true })
  p.text(fmtDate(v.date) || '-', 165, 487, 10, { bold: true })
  p.text('FINANCIAL YEAR', 262, 500, 7, { color: GREY, bold: true })
  p.text(v.financialYearTitle || '-', 262, 487, 10, { bold: true })
  p.rect(LEFT, 474, RIGHT - LEFT, 1, RULE)

  p.text(payment ? 'PAID BY' : 'RECEIVED BY', LEFT, 456, 7, { color: GREY, bold: true })
  p.text(clip(chapter?.name ?? 'ME-CONNECT', 28), LEFT, 442, 11, { bold: true })
  if (region) p.text(region.name, LEFT, 429, 9, { color: GREY })

  p.rect(LEFT, 386, RIGHT - LEFT, 22, payment ? WASH_RED : WASH_GREEN)
  p.text('PARTICULARS', LEFT + 10, 393, 7, { color: GREY, bold: true })
  p.text('AMOUNT', RIGHT - 10, 393, 7, { color: GREY, bold: true, right: true })
  p.text(clip(v.headName, 40), LEFT + 10, 371, 10, { bold: true })
  p.text(payment ? 'Expense head' : 'Income head', LEFT + 10, 358, 8, { color: GREY })
  p.text(money(v.amount), RIGHT - 10, 371, 10, { bold: true, right: true })

  const totalY = 334
  p.rect(LEFT, totalY + 13, RIGHT - LEFT, 1, RULE)
  p.text(payment ? 'Amount paid' : 'Amount received', RIGHT - 110, totalY, 10, { bold: true, right: true })
  p.text(money(v.amount), RIGHT - 10, totalY, 12, { bold: true, color, right: true })

  // Amount in words highlighted card
  const wordsY = totalY - 17
  p.rect(LEFT, wordsY - 4, RIGHT - LEFT, 17, payment ? WASH_RED : WASH_GREEN)
  p.rect(LEFT, wordsY - 4, RIGHT - LEFT, 0.5, RULE)
  p.rect(LEFT, wordsY + 13, RIGHT - LEFT, 0.5, RULE)
  p.rect(LEFT, wordsY - 4, 3, 17, color)
  p.text('Amount in Words:', LEFT + 8, wordsY + 2, 7.5, { bold: true, color })
  p.text(clip(amountInWords(v.amount), 56), LEFT + 78, wordsY + 2, 7.5, { bold: true, color: INK })

  const detailsY = wordsY - 24
  p.text('PAYMENT DETAILS', LEFT, detailsY, 7, { color: GREY, bold: true })
  p.text('Mode of pay', LEFT, detailsY - 14, 8.5, { color: GREY })
  p.text(clip(v.modeName || '-', 22), LEFT + 85, detailsY - 14, 8.5, { bold: true })
  p.text('Date', LEFT, detailsY - 27, 8.5, { color: GREY })
  p.text(fmtDate(v.date) || '-', LEFT + 85, detailsY - 27, 8.5, { bold: true })
  if (v.remarks) {
    p.text('Remarks', LEFT, detailsY - 40, 8.5, { color: GREY })
    wrap(v.remarks, 45).slice(0, 3).forEach((line, i) => p.text(line, LEFT + 85, detailsY - 40 - i * 11, 8.5, { bold: true }))
  }
  preparedBy(p, v.chapterId, detailsY)

  // signatures
  const line = (x: number, w: number, label: string) => {
    p.rect(x, 85, w, 0.7, [0.6, 0.63, 0.68])
    p.text(label, x, 73, 8, { color: GREY })
  }
  line(LEFT, 130, payment ? 'Authorised by' : 'Verified by')
  line(RIGHT - 130, 130, payment ? 'Received by' : 'Treasurer')

  footer(p, 'This is a computer-generated voucher and needs no physical signature.')
  return assemblePdf([p])
}

/** Saves the voucher as a PDF named ME-CONNECT_{Chapter}_{Prefix}_{FinancialYear}_{Number}.pdf. */
export function downloadVoucher(info: VoucherInfo) {
  const url = URL.createObjectURL(buildVoucherPdf(info))
  const a = document.createElement('a')
  a.href = url
  a.download = printableName(info.voucher.number, info.chapter?.name, safeName(info.voucher.financialYearTitle) || financialYearLabel(info.voucher.chapterId, info.voucher.date))
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Puts the drawn pages into one PDF file, with the ME-CONNECT logo as an image every page can use. */
function assemblePdf(pages: Page[]): Blob {
  const logo = getPdfLogo()
  const imageNo = 5 + pages.length * 2
  const objects: (string | Uint8Array)[][] = [
    ['<< /Type /Catalog /Pages 2 0 R >>'],
    [`<< /Type /Pages /Kids [${pages.map((_, n) => `${5 + n * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`],
    ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'],
    ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'],
  ]
  const xobject = logo ? ` /XObject << /Im1 ${imageNo} 0 R >>` : ''
  pages.forEach((page, n) => {
    const content = page.ops.join('\n')
    objects.push([`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A5.w} ${A5.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobject} >> /Contents ${6 + n * 2} 0 R >>`])
    objects.push([`<< /Length ${content.length} >>\nstream\n${content}\nendstream`])
  })
  if (logo) {
    objects.push([
      `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`,
      logo.bytes,
      '\nendstream',
    ])
  }

  /* built as bytes, because the logo is binary and the cross-reference table counts bytes */
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  let size = 0
  const put = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? enc.encode(part) : part
    chunks.push(bytes)
    size += bytes.length
  }
  put('%PDF-1.4\n')
  const offsets: number[] = []
  objects.forEach((parts, n) => {
    offsets.push(size)
    put(`${n + 1} 0 obj\n`)
    parts.forEach(put)
    put('\nendobj\n')
  })
  const xref = size
  put(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`)
  for (const o of offsets) put(`${String(o).padStart(10, '0')} 00000 n \n`)
  put(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' })
}

/** One statement listing several pending invoices, with a total. A single invoice gets the normal invoice instead. */
export function buildStatementPdf(items: InvoiceInfo[]): Blob {
  if (items.length === 1) return buildInvoicePdf(items[0])
  const { member: m, chapter, region } = items[0]
  const total = Math.round(items.reduce((n, x) => n + x.invoice.amount, 0) * 100) / 100
  const pages: Page[] = []

  const header = (p: Page, first: boolean) => {
    band(p, RED, 'STATEMENT', chapter, region)
    if (!first) return 505
    p.text('BILLED TO', LEFT, 500, 7, { color: GREY, bold: true })
    p.text(clip(m.name, 28), LEFT, 486, 11, { bold: true })
    p.text(`Mobile: ${m.mobile}`, LEFT, 473, 9, { color: GREY })
    p.text(clip(`${chapter?.name ?? ''}${region ? `, ${region.name}` : ''}`, 34), LEFT, 461, 9, { color: GREY })
    p.text('PAY TO', 235, 500, 7, { color: GREY, bold: true })
    p.text(clip(chapter?.upiName || chapter?.name || 'ME-CONNECT', 24), 235, 486, 11, { bold: true })
    if (chapter?.upiId) p.text(clip(`UPI ID: ${chapter.upiId}`, 30), 235, 473, 9, { color: GREY })
    p.text('PENDING INVOICES', LEFT, 440, 7, { color: GREY, bold: true })
    return 432
  }
  const tableHead = (p: Page, y: number) => {
    p.rect(LEFT, y - 18, RIGHT - LEFT, 22, WASH_RED)
    p.text('INVOICE NO.', LEFT + 8, y - 11, 7, { color: GREY, bold: true })
    p.text('DESCRIPTION', LEFT + 100, y - 11, 7, { color: GREY, bold: true })
    p.text('DUE', 262, y - 11, 7, { color: GREY, bold: true })
    p.text('AMOUNT', RIGHT - 8, y - 11, 7, { color: GREY, bold: true, right: true })
    return y - 34
  }

  let page = new Page()
  pages.push(page)
  let y = tableHead(page, header(page, true))
  for (const { invoice: i } of items) {
    if (y < 130) {
      page = new Page()
      pages.push(page)
      y = tableHead(page, header(page, false))
    }
    page.text(clip(invoiceNo(i), 18), LEFT + 8, y, 8.5, { bold: true })
    page.text(clip(i.label, 20), LEFT + 100, y, 8.5)
    page.text(i.dueDate ? fmtDate(i.dueDate) : '-', 262, y, 8.5, { color: i.dueDate ? RED : GREY })
    page.text(money(i.amount), RIGHT - 8, y, 8.5, { bold: true, right: true })
    page.rect(LEFT, y - 6, RIGHT - LEFT, 0.5, RULE)
    y -= 18
  }
  if (y < 110) {
    page = new Page()
    pages.push(page)
    y = header(page, false) - 10
  }
  page.text('Total due', RIGHT - 110, y - 8, 10, { bold: true, right: true })
  page.text(money(total), RIGHT - 8, y - 8, 12, { bold: true, color: RED, right: true })

  // Amount in words highlighted card
  const wordsY = y - 27
  page.rect(LEFT, wordsY - 4, RIGHT - LEFT, 17, WASH_RED)
  page.rect(LEFT, wordsY - 4, 3, 17, RED)
  page.text('Amount in Words:', LEFT + 8, wordsY + 2, 7.5, { bold: true, color: RED })
  page.text(clip(amountInWords(total), 58), LEFT + 78, wordsY + 2, 7.5, { bold: true, color: INK })

  pages.forEach((pg, n) => {
    /* the same spot on every page: bottom right, above the footer */
    preparedBy(pg, m.chapterId, 88)
    footer(pg, 'This is a computer-generated statement and needs no physical signature.', `Page ${n + 1} of ${pages.length}`)
  })
  return assemblePdf(pages)
}

/** Saves every pending invoice of a member as one PDF statement. */
export function downloadStatement(items: InvoiceInfo[]) {
  if (items.length === 0) return
  const url = URL.createObjectURL(buildStatementPdf(items))
  const a = document.createElement('a')
  a.href = url
  const first = items[0]
  const year = financialYearLabel(first.member.chapterId, first.invoice.issuedAt || first.invoice.dueDate || first.invoice.paidAt || '')
  a.download =
    items.length === 1
      ? printableName(invoiceNo(first.invoice), first.chapter?.name, year)
      : `ME-CONNECT_${safeName(first.chapter?.name || 'Chapter')}_Statement_${year}_${items.length}-invoices.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** One receipt listing several verified payments, with a total. A single payment gets the normal receipt instead. */
export function buildReceiptsPdf(items: InvoiceInfo[]): Blob {
  if (items.length === 1) return buildReceiptPdf(items[0])
  const { member: m, chapter, region } = items[0]
  const total = Math.round(items.reduce((n, x) => n + x.invoice.amount, 0) * 100) / 100
  const pages: Page[] = []

  const header = (p: Page, first: boolean) => {
    band(p, GREEN, 'RECEIPTS', chapter, region)
    if (!first) return 505
    p.text('RECEIVED FROM', LEFT, 500, 7, { color: GREY, bold: true })
    p.text(clip(m.name, 28), LEFT, 486, 11, { bold: true })
    p.text(`Mobile: ${m.mobile}`, LEFT, 473, 9, { color: GREY })
    p.text(clip(`${chapter?.name ?? ''}${region ? `, ${region.name}` : ''}`, 34), LEFT, 461, 9, { color: GREY })
    p.text('RECEIVED BY', 235, 500, 7, { color: GREY, bold: true })
    p.text(clip(chapter?.upiName || chapter?.name || 'ME-CONNECT', 24), 235, 486, 11, { bold: true })
    p.text('PAYMENTS RECEIVED', LEFT, 440, 7, { color: GREY, bold: true })
    return 432
  }
  const tableHead = (p: Page, y: number) => {
    p.rect(LEFT, y - 18, RIGHT - LEFT, 22, WASH_GREEN)
    p.text('RECEIPT NO.', LEFT + 8, y - 11, 7, { color: GREY, bold: true })
    p.text('PAYMENT FOR', 110, y - 11, 7, { color: GREY, bold: true })
    p.text('PAID ON', 182, y - 11, 7, { color: GREY, bold: true })
    p.text('MODE', 245, y - 11, 7, { color: GREY, bold: true })
    p.text('AMOUNT', RIGHT - 8, y - 11, 7, { color: GREY, bold: true, right: true })
    return y - 34
  }

  let page = new Page()
  pages.push(page)
  let y = tableHead(page, header(page, true))
  for (const { invoice: i } of items) {
    if (y < 130) {
      page = new Page()
      pages.push(page)
      y = tableHead(page, header(page, false))
    }
    page.text(clip(receiptNo(i), 14), LEFT + 8, y, 8, { bold: true })
    page.text(clip(i.label, 16), 110, y, 8)
    page.text(fmtDate(i.paidAt ?? '') || '-', 182, y, 8)
    page.text(clip(i.modeName || i.method || '-', 11), 245, y, 8)
    page.text(money(i.amount), RIGHT - 8, y, 8, { bold: true, right: true })
    page.rect(LEFT, y - 6, RIGHT - LEFT, 0.5, RULE)
    y -= 16
  }
  if (y < 110) {
    page = new Page()
    pages.push(page)
    y = header(page, false) - 10
  }
  page.text('Total paid', RIGHT - 110, y - 8, 10, { bold: true, right: true })
  page.text(money(total), RIGHT - 8, y - 8, 12, { bold: true, color: GREEN, right: true })

  // Amount in words highlighted card
  const wordsY = y - 27
  page.rect(LEFT, wordsY - 4, RIGHT - LEFT, 17, WASH_GREEN)
  page.rect(LEFT, wordsY - 4, 3, 17, GREEN)
  page.text('Amount in Words:', LEFT + 8, wordsY + 2, 7.5, { bold: true, color: GREEN })
  page.text(clip(amountInWords(total), 58), LEFT + 78, wordsY + 2, 7.5, { bold: true, color: INK })

  pages.forEach((pg, n) => {
    preparedBy(pg, m.chapterId, 88)
    footer(pg, 'This is a computer-generated receipt and needs no physical signature.', `Page ${n + 1} of ${pages.length}`)
  })
  return assemblePdf(pages)
}

/** Saves every verified payment of a member as one PDF receipt. */
export function downloadReceipts(items: InvoiceInfo[]) {
  if (items.length === 0) return
  const url = URL.createObjectURL(buildReceiptsPdf(items))
  const a = document.createElement('a')
  a.href = url
  const first = items[0]
  const year = financialYearLabel(first.member.chapterId, first.invoice.verifiedAt || first.invoice.paidAt || '')
  a.download =
    items.length === 1
      ? printableName(receiptNo(first.invoice), first.chapter?.name, year)
      : `ME-CONNECT_${safeName(first.chapter?.name || 'Chapter')}_Receipts_${year}_${items.length}-payments.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Saves the receipt for the fee a visitor paid when registering. It reads as a normal receipt: the visitor is "received from". */
export function downloadVisitorReceipt({ payment, chapter, region }: { payment: VisitorPayment; chapter: Chapter | null; region: Region | null }) {
  const visitor = { id: payment.id, regionId: chapter?.regionId ?? '', chapterId: payment.chapterId, name: payment.visitorName, mobile: payment.visitorPhone, organisation: '', designation: 'Visitor' } as Member
  const invoice: Invoice = {
    id: payment.id,
    no: '-',
    memberId: payment.id,
    label: 'Visitor fee',
    kind: 'Visitor fee',
    amount: payment.amount,
    dueDate: '',
    status: 'paid',
    paidAt: payment.paidAt,
    verifiedAt: payment.paidAt,
    modeName: payment.mode,
    ref: payment.receipt,
  }
  downloadReceipt({ invoice, member: visitor, chapter, region })
}
