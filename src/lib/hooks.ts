import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/** Calls `onOutside` when the user presses outside `ref` or hits Escape, while `active`. */
export function useDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onOutside: () => void) {
  useEffect(() => {
    if (!active) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onOutside()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOutside()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, active, onOutside])
}

const nowMs = () => Date.now()

/** The current time in ms, refreshed every `everyMs`. */
export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(nowMs)
  useEffect(() => {
    const t = window.setInterval(() => setNow(nowMs()), everyMs)
    return () => window.clearInterval(t)
  }, [everyMs])
  return now
}
