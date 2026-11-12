import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Keyboard, ScanLine, X } from 'lucide-react'

/**
 * Full-screen camera scanner. Calls `onResult` with the text of the first QR code it
 * sees, or with whatever the member types if the camera cannot be used.
 */
export default function QrScanner({ onResult, onClose, error: serverError }: { onResult: (text: string) => void; onClose: () => void; error?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const resultRef = useRef(onResult)
  const [camError, setCamError] = useState('')
  const [live, setLive] = useState(false)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    resultRef.current = onResult
  })

  useEffect(() => {
    let stopped = false
    let raf = 0
    let stream: MediaStream | undefined
    let jsQR: typeof import('jsqr').default | undefined
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    function stop() {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }

    function tick() {
      if (stopped) return
      const v = videoRef.current
      if (v && ctx && v.readyState >= 2 && v.videoWidth) {
        canvas.width = v.videoWidth
        canvas.height = v.videoHeight
        ctx.drawImage(v, 0, 0)
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const hit = jsQR?.(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
        if (hit?.data) {
          stop()
          resultRef.current(hit.data)
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }

    async function start() {
      jsQR = (await import('jsqr')).default
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError('This browser cannot open the camera here. Type the code shown under the QR instead.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        await v.play()
        setLive(true)
        tick()
      } catch {
        setCamError('Camera access was blocked or no camera was found. Type the code shown under the QR instead.')
      }
    }

    void start()
    return stop
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (typed.trim()) onResult(typed.trim())
  }

  return createPortal(
    <div className="scan" role="dialog" aria-modal="true" aria-label="Scan attendance QR code">
      <div className="scan__card">
        <div className="scan__head">
          <h2>
            <ScanLine size={20} /> Scan QR code
          </h2>
          <button type="button" className="scan__x" onClick={onClose} aria-label="Close scanner">
            <X size={18} />
          </button>
        </div>

        <div className={`scan__view ${live ? 'is-live' : ''}`}>
          <video ref={videoRef} muted playsInline />
          <span className="scan__frame" aria-hidden />
          {!live && !camError && <p className="scan__wait">Starting camera…</p>}
          {camError && <p className="scan__wait">{camError}</p>}
        </div>
        <p className="scan__hint">Point the camera at the QR code on the attendance coordinator’s screen.</p>

        <form className="scan__manual" onSubmit={submit}>
          <label htmlFor="scan-code">
            <Keyboard size={15} /> Or type the 6-character code
          </label>
          <div>
            <input id="scan-code" className="field__control" value={typed} maxLength={6} autoComplete="off" placeholder="e.g. 4K7Q2Z" onChange={(e) => setTyped(e.target.value.toUpperCase())} />
            <button className="btn btn--primary btn--sm" type="submit" disabled={typed.trim().length < 6}>
              Mark
            </button>
          </div>
        </form>
        {serverError && <div className="form-error">{serverError}</div>}
      </div>
    </div>,
    document.body,
  )
}
