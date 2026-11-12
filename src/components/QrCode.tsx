import { useEffect, useState } from 'react'

/** Draws `text` as a QR code image. */
export default function QrCode({ text, size = 240 }: { text: string; size?: number }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let live = true
    import('qrcode')
      .then((m) => m.default.toDataURL(text, { width: size * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#14201F', light: '#FFFFFF' } }))
      .then((url) => {
        if (live) setSrc(url)
      })
      .catch(() => {
        if (live) setSrc('')
      })
    return () => {
      live = false
    }
  }, [text, size])

  return src ? (
    <img className="qr" src={src} width={size} height={size} alt="Attendance QR code" />
  ) : (
    <div className="qr qr--wait" style={{ width: size, height: size }} aria-hidden />
  )
}
