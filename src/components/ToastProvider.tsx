import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Info } from 'lucide-react'
import { ToastContext } from '../lib/toast'
import type { ToastTone } from '../lib/toast'

interface Toast {
  id: number
  text: string
  tone: ToastTone
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  function push(text: string, tone: ToastTone = 'ok') {
    const id = ++seq.current
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              {t.tone === 'ok' ? <CheckCircle2 size={17} /> : <Info size={17} />}
              {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
