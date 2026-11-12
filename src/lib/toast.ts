import { createContext, useContext } from 'react'

export type ToastTone = 'ok' | 'info'

export const ToastContext = createContext<((text: string, tone?: ToastTone) => void) | null>(null)

export function useToast() {
  const push = useContext(ToastContext)
  if (!push) throw new Error('useToast must be used inside <ToastProvider>')
  return push
}
