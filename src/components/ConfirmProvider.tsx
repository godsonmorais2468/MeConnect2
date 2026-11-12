import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Trash2 } from 'lucide-react'
import { ConfirmContext } from '../lib/confirm'
import type { ConfirmOptions } from '../lib/confirm'

interface Pending extends ConfirmOptions {
  done: (ok: boolean) => void
}

export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  const ask = useCallback((options: ConfirmOptions) => new Promise<boolean>((done) => setPending({ ...options, done })), [])

  const answer = useCallback(
    (ok: boolean) => {
      pending?.done(ok)
      setPending(null)
    },
    [pending],
  )

  useEffect(() => {
    if (!pending) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && answer(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, answer])

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending &&
        createPortal(
          <div className="confirm" onMouseDown={() => answer(false)}>
            <div className="confirm__card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text" onMouseDown={(e) => e.stopPropagation()}>
              <span className="confirm__ico">
                <Trash2 size={22} />
              </span>
              <h2 id="confirm-title">{pending.title ?? 'Are you sure?'}</h2>
              <p id="confirm-text">{pending.message}</p>
              <div className="confirm__acts">
                <button ref={cancelRef} type="button" className="btn btn--ghost" onClick={() => answer(false)}>
                  Cancel
                </button>
                <button type="button" className="btn confirm__ok" onClick={() => answer(true)}>
                  {pending.confirmLabel ?? 'Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmContext.Provider>
  )
}
