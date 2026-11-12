import { inr } from './format'
import { getPdfLogo } from './pdfLogo'

const A4 = { w: 595, h: 842 }
const RED: [number, number, number] = [0.06, 0.18, 0.17]
const INK: [number, number, number] = [0.078, 0.125, 0.122]
const GREY: [number, number, number] = [0.42, 0.46, 0.52]
const LIGHT_BG: [number, number, number] = [0.965, 0.97, 0.98]
const BORDER: [number, number, number] = [0.88, 0.89, 0.91]

const plain = (s: string) =>
  String(s ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/₹/g, 'Rs. ')
    .replace(/[·•]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E\n]/g, '?')

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

export function textWidth(s: string, size: number, bold: boolean): number {
  const p = plain(s)
  const map = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS
  let units = 0
  for (let i = 0; i < p.length; i++) {
    const code = p.charCodeAt(i)
    units += map[code] ?? (bold ? 600 : 550)
  }
  return (units / 1000) * size
}

const esc = (s: string) => plain(s).replace(/\n/g, ' ').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

function wrap(text: string, maxWidth: number, size = 8.5, bold = false): string[] {
  const p = plain(text)
  const segments = p.split('\n')
  const result: string[] = []

  for (const seg of segments) {
    const words = seg.split(/\s+/).filter(Boolean)
    if (!words.length) {
      result.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (textWidth(candidate, size, bold) > maxWidth) {
        if (line) result.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    if (line) result.push(line)
  }
  return result.length ? result : ['']
}

export class PdfPage {
  ops: string[] = []

  rect(x: number, y: number, w: number, h: number, c: [number, number, number]) {
    this.ops.push(`${c.join(' ')} rg ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`)
  }

  text(
    s: string,
    x: number,
    y: number,
    size = 9,
    opts: { bold?: boolean; color?: [number, number, number]; right?: boolean } = {}
  ) {
    const { bold = false, color = INK, right = false } = opts
    const left = right ? x - textWidth(s, size, bold) : x
    this.ops.push(
      `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color.join(' ')} rg ${left.toFixed(1)} ${y.toFixed(1)} Td (${esc(s)}) Tj ET`
    )
  }

  /** A check mark centred on (cx, cy), drawn as lines: the standard PDF font has no tick. */
  tick(cx: number, cy: number, c: [number, number, number]) {
    this.ops.push(`q ${c.join(' ')} RG 1.7 w 1 J 1 j ${(cx - 4.2).toFixed(1)} ${(cy - 0.2).toFixed(1)} m ${(cx - 1.2).toFixed(1)} ${(cy - 3.4).toFixed(1)} l ${(cx + 4.4).toFixed(1)} ${(cy + 3.6).toFixed(1)} l S Q`)
  }

  /** A cross centred on (cx, cy), drawn as lines. */
  cross(cx: number, cy: number, c: [number, number, number]) {
    this.ops.push(`q ${c.join(' ')} RG 1.7 w 1 J ${(cx - 3.3).toFixed(1)} ${(cy - 3.3).toFixed(1)} m ${(cx + 3.3).toFixed(1)} ${(cy + 3.3).toFixed(1)} l S ${(cx - 3.3).toFixed(1)} ${(cy + 3.3).toFixed(1)} m ${(cx + 3.3).toFixed(1)} ${(cy - 3.3).toFixed(1)} l S Q`)
  }

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
      ].join('\n')
    )
  }
}

export function assemblePdf(pages: PdfPage[]): Blob {
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
    objects.push([
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobject} >> /Contents ${6 + n * 2} 0 R >>`,
    ])
    objects.push([`<< /Length ${content.length} >>\nstream\n${content}\nendstream`])
  })
  if (logo) {
    objects.push([
      `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`,
      logo.bytes,
      '\nendstream',
    ])
  }

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

export interface TableColumn {
  title: string
  width: number
  align?: 'left' | 'right' | 'center'
  /** Bold cells. By default the first and the last column are bold. */
  bold?: boolean
  /** Cells hold 'yes' or 'no' and are drawn as a green tick or a red cross. The column is centred. */
  marks?: boolean
}

/** A further table printed under the main one, with its own heading. */
export interface ExtraTable {
  title: string
  columns: TableColumn[]
  rows: string[][]
}

export interface ReportPdfOptions {
  title: string
  subtitle?: string
  chapterName: string
  summaryStats?: { label: string; value: string }[]
  /** The report's total, printed once under the last row on the right: "Label: Rs. 5,000", then the amount in words in brackets. */
  amountInWords?: { label?: string; amount?: number; text?: string }
  columns: TableColumn[]
  rows: string[][]
  extraTables?: ExtraTable[]
  filename: string
}

export function downloadReportPdf({
  title,
  subtitle,
  chapterName,
  summaryStats = [],
  amountInWords: wordsOpt,
  columns,
  rows,
  extraTables = [],
  filename,
}: ReportPdfOptions) {
  const pages: PdfPage[] = []
  const left = 36
  const right = A4.w - 36
  const totalTableWidth = right - left

  // Adjust column widths if total doesn't match totalTableWidth
  const normalize = (cols: TableColumn[]) => {
    const currentTotal = cols.reduce((acc, c) => acc + c.width, 0)
    const out = cols.map((c) => ({
      ...c,
      width: Math.floor((c.width / currentTotal) * totalTableWidth),
    }))
    const allocated = out.reduce((acc, c) => acc + c.width, 0)
    if (allocated < totalTableWidth && out.length > 0) {
      out[out.length - 1].width += totalTableWidth - allocated
    }
    return out
  }
  const normColumns = normalize(columns)

  const drawHeader = (p: PdfPage, isFirst: boolean): number => {
    // Red top banner with crisp branding
    p.rect(0, 768, A4.w, 74, RED)
    const logo = getPdfLogo()
    if (logo) {
      p.logo(left, 786, 72, 30)
    }
    const titleX = logo ? left + 82 : left
    p.text('ME-CONNECT', titleX, 812, 17, { bold: true, color: [1, 1, 1] })
    p.text(chapterName.toUpperCase(), titleX, 795, 9, { color: [1, 1, 1] })
    p.text(title.toUpperCase(), right, 804, 13, { bold: true, color: [1, 1, 1], right: true })

    if (isFirst) {
      let curY = 744
      if (subtitle) {
        p.text(subtitle, left, curY, 8.5, { color: GREY })
        curY -= 15
      }
      if (summaryStats.length > 0) {
        p.rect(left, curY - 24, right - left, 30, LIGHT_BG)
        p.rect(left, curY - 24, right - left, 0.5, BORDER)
        p.rect(left, curY + 6, right - left, 0.5, BORDER)
        const colW = (right - left) / summaryStats.length
        summaryStats.forEach((st, i) => {
          const sx = left + i * colW + 12
          p.text(st.label.toUpperCase(), sx, curY - 8, 7.2, { color: GREY, bold: true })
          p.text(st.value, sx, curY - 20, 9.5, { bold: true, color: RED })
          if (i > 0) {
            p.rect(left + i * colW, curY - 24, 0.5, 30, BORDER)
          }
        })
        curY -= 36
      }

      return curY
    }
    return 748
  }

  const drawTableHeader = (p: PdfPage, y: number, cols = normColumns): number => {
    // Measure max lines needed across column headers using actual font metrics
    const headerLines = cols.map((c) => {
      return wrap(c.title.toUpperCase(), c.width - 16, 7.5, true)
    })
    const maxHCount = Math.max(...headerLines.map((l) => l.length), 1)
    const hHeight = Math.max(22, maxHCount * 10 + 10)

    p.rect(left, y - hHeight + 4, right - left, hHeight, [0.93, 0.94, 0.96])
    let curX = left
    cols.forEach((c, colIdx) => {
      const lines = headerLines[colIdx]
      lines.forEach((line, lineIdx) => {
        const textY = y - 8 - lineIdx * 10
        if (c.align === 'right') {
          p.text(line, curX + c.width - 8, textY, 7.5, { bold: true, color: GREY, right: true })
        } else if (c.align === 'center' || c.marks) {
          p.text(line, curX + (c.width - textWidth(line, 7.5, true)) / 2, textY, 7.5, { bold: true, color: GREY })
        } else {
          p.text(line, curX + 6, textY, 7.5, { bold: true, color: GREY })
        }
      })
      curX += c.width
    })
    return y - hHeight - 4
  }

  let page = new PdfPage()
  pages.push(page)
  let y = drawTableHeader(page, drawHeader(page, true))

  const drawRows = (cols: ReturnType<typeof normalize>, data: string[][]) => data.forEach((row, rowIdx) => {
    const boldOf = (colIdx: number) => cols[colIdx].bold ?? (colIdx === 0 || colIdx === cols.length - 1)
    // Determine max lines for this row using actual font metrics
    const cellLines = row.map((text, colIdx) => {
      const col = cols[colIdx]
      return col.marks ? [''] : wrap(text, col.width - 16, 8.5, boldOf(colIdx))
    })
    const maxLineCount = Math.max(...cellLines.map((l) => l.length), 1)
    const rowHeight = Math.max(18, maxLineCount * 11 + 6)

    if (y - rowHeight < 48) {
      page = new PdfPage()
      pages.push(page)
      y = drawTableHeader(page, drawHeader(page, false), cols)
    }

    if (rowIdx % 2 === 1) {
      page.rect(left, y - rowHeight + 4, right - left, rowHeight, [0.98, 0.98, 0.99])
    }

    let curX = left
    cols.forEach((col, colIdx) => {
      const lines = cellLines[colIdx]
      if (col.marks) {
        const cx = curX + col.width / 2
        if (row[colIdx] === 'yes') page.tick(cx, y - 6, [0.04, 0.42, 0.27])
        else page.cross(cx, y - 6, RED)
        curX += col.width
        return
      }
      lines.forEach((line, lineIdx) => {
        const textY = y - 9 - lineIdx * 11
        if (col.align === 'right') {
          page.text(line, curX + col.width - 8, textY, 8.5, {
            right: true,
            bold: boldOf(colIdx),
          })
        } else {
          page.text(line, curX + 6, textY, 8.5, {
            bold: boldOf(colIdx),
          })
        }
      })
      curX += col.width
    })

    page.rect(left, y - rowHeight + 3, right - left, 0.5, BORDER)
    y -= rowHeight
  })
  drawRows(normColumns, rows)

  // Further tables (for example the visitors) go below the main one, each with its own heading
  for (const extra of extraTables) {
    const cols = normalize(extra.columns)
    if (y - 80 < 48) {
      page = new PdfPage()
      pages.push(page)
      y = drawHeader(page, false)
    }
    y -= 10
    page.text(extra.title, left, y - 8, 10, { bold: true, color: INK })
    y -= 18
    y = drawTableHeader(page, y, cols)
    drawRows(cols, extra.rows)
  }

  // The total, on the right just below the table: the figure, then the same amount in words in brackets
  const wordsText = wordsOpt ? wordsOpt.text || (wordsOpt.amount !== undefined ? amountInWords(wordsOpt.amount) : '') : ''
  if (wordsText) {
    if (y - 44 < 48) {
      page = new PdfPage()
      pages.push(page)
      y = drawHeader(page, false)
    }
    if (wordsOpt?.label && wordsOpt.amount !== undefined) {
      page.text(`${wordsOpt.label}: ${inr(wordsOpt.amount)}`, right - 8, y - 12, 9.5, { bold: true, color: RED, right: true })
      y -= 16
    }
    page.text(`(${wordsText})`, right - 8, y - 12, 8.5, { bold: true, color: INK, right: true })
    y -= 22
  }

  // Highlighted, professional footer on every page
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

  pages.forEach((pg, i) => {
    // 1. Clean tinted container bar
    pg.rect(left, 16, right - left, 22, [0.965, 0.972, 0.982])
    // 2. Crisp top separator border
    pg.rect(left, 38, right - left, 0.75, [0.86, 0.88, 0.91])
    // 3. Signature brand vertical accent tab on left edge
    pg.rect(left, 16, 3, 22, RED)

    // 4. Highlighted metadata & brand attribution
    let curX = left + 9
    pg.text('Printed On : ', curX, 24, 7.3, { bold: true, color: INK })
    curX += textWidth('Printed On : ', 7.3, true)

    pg.text(`${dateStr} ${timeStr}`, curX, 24, 7.3, { color: GREY })
    curX += textWidth(`${dateStr} ${timeStr}`, 7.3, false)

    pg.text('  |  ', curX, 24, 7.3, { color: [0.75, 0.78, 0.82] })
    curX += textWidth('  |  ', 7.3, false)

    pg.text('ME-CONNECT App 3.0', curX, 24, 7.3, { bold: true, color: INK })
    curX += textWidth('ME-CONNECT App 3.0', 7.3, true)

    pg.text(' - Powered By ', curX, 24, 7.3, { color: GREY })
    curX += textWidth(' - Powered By ', 7.3, false)

    pg.text('www.geosysitsolutions.com', curX, 24, 7.3, { bold: true, color: RED })

    // 5. Crisp Page Number Badge on the right
    pg.text(`Page ${i + 1} of ${pages.length}`, right - 10, 24, 7.3, { bold: true, color: INK, right: true })
  })

  const blob = assemblePdf(pages)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}
