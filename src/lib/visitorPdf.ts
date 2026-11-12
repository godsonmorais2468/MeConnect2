import QRCode from 'qrcode'

export interface VisitorStandeeInfo {
  chapterName: string
  registrationUrl: string
}

// A5 portrait dimensions: 148 mm x 210 mm = 419.53 x 595.28 pt
const A5 = { w: 420, h: 595 }

const RED: [number, number, number] = [0.06, 0.18, 0.17] // #0F2E2B
const NAVY: [number, number, number] = [0.063, 0.137, 0.247] // #10233F
const GREY: [number, number, number] = [0.42, 0.46, 0.52]
const DIM_FOOTER: [number, number, number] = [0.65, 0.68, 0.72]

const plain = (s: string) =>
  s
    .replace(/₹/g, 'Rs. ')
    .replace(/[·•]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, '?')

const esc = (s: string) => plain(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
const textWidth = (s: string, size: number, bold: boolean) => plain(s).length * size * (bold ? 0.58 : 0.53)

class Page {
  ops: string[] = []

  rect(x: number, y: number, w: number, h: number, c: [number, number, number]) {
    this.ops.push(`${c.join(' ')} rg ${x} ${y} ${w} ${h} re f`)
  }

  text(
    s: string,
    x: number,
    y: number,
    size = 10,
    opts: { bold?: boolean; color?: [number, number, number]; right?: boolean; center?: boolean } = {}
  ) {
    const { bold = false, color = NAVY, right = false, center = false } = opts
    let left = x
    const tw = textWidth(s, size, bold)
    if (center) {
      left = x - tw / 2
    } else if (right) {
      left = x - tw
    }
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color.join(' ')} rg ${left.toFixed(1)} ${y} Td (${esc(s)}) Tj ET`)
  }
}

function assembleA5Pdf(pages: Page[]): Blob {
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, n) => `${5 + n * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ]
  pages.forEach((page, n) => {
    const content = page.ops.join('\n')
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A5.w} ${A5.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + n * 2} 0 R >>`)
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, n) => {
    offsets.push(pdf.length)
    pdf += `${n + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}

/** Builds an A5 portrait Visitor Host QR standee PDF. */
export function buildVisitorStandeePdf({ chapterName, registrationUrl }: VisitorStandeeInfo): Blob {
  const p = new Page()
  const midX = A5.w / 2

  // Background subtle tint
  p.rect(0, 0, A5.w, A5.h, [1, 1, 1])

  // Top header red banner
  p.rect(0, A5.h - 85, A5.w, 85, RED)

  // Name badge
  p.text('ME-CONNECT', midX, A5.h - 32, 22, { bold: true, color: [1, 1, 1], center: true })
  p.text('GIVERS GAIN', midX, A5.h - 48, 8, { bold: true, color: [0.95, 0.7, 0.24], center: true })
  p.text('VISITOR & SUBSTITUTE CHECK-IN', midX, A5.h - 68, 12, { bold: true, color: [1, 1, 1], center: true })

  // Chapter Name
  let curY = A5.h - 118
  p.text(chapterName.toUpperCase(), midX, curY, 20, { bold: true, color: NAVY, center: true })
  curY -= 18
  p.text('CHAPTER', midX, curY, 9, { bold: true, color: GREY, center: true })

  // (the visitor host and chapter lead names are no longer printed)
  curY -= 28
  const infoBoxH = 0

  // QR Code Generation
  const qr = QRCode.create(registrationUrl, { errorCorrectionLevel: 'M' })
  const modSize = qr.modules.size
  const qrDisplaySize = 210 // 210 pt square
  const cellSize = qrDisplaySize / modSize
  const qrX = (A5.w - qrDisplaySize) / 2
  const qrY = curY - infoBoxH - qrDisplaySize - 16

  // Frame around QR
  p.rect(qrX - 12, qrY - 12, qrDisplaySize + 24, qrDisplaySize + 24, [1, 1, 1])
  p.rect(qrX - 12, qrY - 12, qrDisplaySize + 24, 1, [0.88, 0.9, 0.92]) // bottom line
  p.rect(qrX - 12, qrY + qrDisplaySize + 11, qrDisplaySize + 24, 1, [0.88, 0.9, 0.92]) // top line
  p.rect(qrX - 12, qrY - 12, 1, qrDisplaySize + 24, [0.88, 0.9, 0.92]) // left line
  p.rect(qrX + qrDisplaySize + 11, qrY - 12, 1, qrDisplaySize + 24, [0.88, 0.9, 0.92]) // right line

  // Render vector QR modules
  for (let r = 0; r < modSize; r++) {
    for (let c = 0; c < modSize; c++) {
      if (qr.modules.get(r, c)) {
        // PDF Y-axis starts from bottom, so invert row
        const cellX = qrX + c * cellSize
        const cellY = qrY + (modSize - 1 - r) * cellSize
        p.rect(cellX, cellY, cellSize + 0.1, cellSize + 0.1, NAVY)
      }
    }
  }

  // Scan instruction
  const instructY = qrY - 32
  p.text('SCAN TO REGISTER AS VISITOR OR CHECK-IN AS SUBSTITUTE', midX, instructY, 8.5, { bold: true, color: RED, center: true })
  p.text('Open your smartphone camera to scan and get started', midX, instructY - 14, 8, { color: GREY, center: true })

  // Footer: Powered by Geosys IT Solutions
  p.rect(0, 32, A5.w, 0.5, [0.9, 0.91, 0.93])
  p.text('Powered by Geosys IT Solutions', midX, 16, 7.5, { bold: false, color: DIM_FOOTER, center: true })

  return assembleA5Pdf([p])
}

/** Triggers download of the A5 standee PDF. */
export function downloadVisitorStandeePdf(info: VisitorStandeeInfo) {
  const blob = buildVisitorStandeePdf(info)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeName = info.chapterName.replace(/[^a-zA-Z0-9_-]/g, '_')
  a.download = `ME-CONNECT_${safeName}_Visitor_Host_Standee_A5.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}
