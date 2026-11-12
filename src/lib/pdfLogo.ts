import logoUrl from '../assets/me-connect-logo.png'

/** The ME-CONNECT logo as JPEG bytes for the PDFs, ready once the picture has loaded (a moment after the page opens). */
export interface PdfLogo {
  bytes: Uint8Array
  width: number
  height: number
}

let logo: PdfLogo | null = null

export const getPdfLogo = () => logo

/* PDF images here have no alpha and sit in a wide slot, so the square mark is drawn centred on a pine tile of that shape. */
function load() {
  if (typeof window === 'undefined') return
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 170
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0F2E2B'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 115, 0, 170, 170)
    canvas.toBlob(
      async (blob) => {
        if (blob) logo = { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height }
      },
      'image/jpeg',
      0.92,
    )
  }
  img.src = logoUrl
}

load()
