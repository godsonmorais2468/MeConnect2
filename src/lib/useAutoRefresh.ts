import { useEffect } from 'react'
import { refreshIfStale, syncWithBackend } from './store'

/**
 * Keeps the data fresh while someone is signed in, so a member, designation, poll or meeting added by somebody
 * else shows up without reloading: every minute while the tab is open and visible, and straight away when the
 * person comes back to the tab, or the connection returns.
 */
export function useAutoRefresh(enabled: boolean, everyMs = 60_000) {
  useEffect(() => {
    if (!enabled) return
    const tick = () => {
      if (document.visibilityState === 'visible') void syncWithBackend()
    }
    const wake = () => {
      if (document.visibilityState === 'visible') refreshIfStale(5_000)
    }
    const timer = window.setInterval(tick, everyMs)
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    window.addEventListener('online', wake)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
      window.removeEventListener('online', wake)
    }
  }, [enabled, everyMs])
}
