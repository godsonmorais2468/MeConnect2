import { createContext, useContext } from 'react'

export interface ConfirmOptions {
  title?: string
  message: string
  /** Text of the main button. Defaults to "Delete". */
  confirmLabel?: string
}

export const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

/** Asks the person to confirm inside the app (instead of the browser's own box). Resolves true on confirm. */
export function useConfirm() {
  const ask = useContext(ConfirmContext)
  if (!ask) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ask
}
