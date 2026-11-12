import { useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { enablePush, needsInstallForPush, pushConfigured, pushPermission } from '../lib/oneSignal'
import { Glyph } from './ui'

/**
 * A quiet prompt to turn on push notifications, shown at the foot of the page above the dock.
 *
 * It never asks for permission on its own: the browser prompt only comes from a tap on "Turn on",
 * and if permission was refused before we point the member at their browser settings instead of
 * asking again (a refused prompt cannot be shown a second time). Dismissing hides it for good.
 */

const DISMISS_KEY = 'me-connect:push-dismissed'

type Mode = 'ask' | 'blocked' | 'install'

function currentMode(): Mode | null {
  if (!pushConfigured()) return null
  if (needsInstallForPush()) return 'install'
  const permission = pushPermission()
  if (permission === 'granted') return null
  if (permission === 'default') return 'ask'
  if (permission === 'denied') return 'blocked'
  return null
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export default function PushPermissionBanner() {
  const [mode, setMode] = useState<Mode | null>(currentMode)
  const [hidden, setHidden] = useState(wasDismissed)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!mode || hidden) return null

  function dismiss() {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* private mode: it will simply come back next visit */
    }
  }

  async function turnOn() {
    setBusy(true)
    setError('')
    try {
      const allowed = await enablePush()
      setMode(allowed ? null : currentMode())
      if (!allowed) {
        setError(
          pushPermission() === 'denied'
            ? 'Notifications are blocked in your browser settings.'
            : 'Permission was not allowed. Tap Turn on to try again.',
        )
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not turn on notifications.')
    } finally {
      setBusy(false)
    }
  }

  const copy: Record<Mode, { title: string; line: string }> = {
    ask: { title: 'Stay in the loop', line: 'Allow notifications for dues, meetings and polls.' },
    blocked: {
      title: 'Notifications are off',
      line: 'Allow notifications for this site in your browser settings to get reminders.',
    },
    install: {
      title: 'Add ME-CONNECT to your Home Screen',
      line: 'On iPhone, tap Share, then “Add to Home Screen” to receive notifications.',
    },
  }

  return (
    <div
      role="region"
      aria-label="Notifications"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(var(--tabs-h) + 20px)',
        transform: 'translateX(-50%)',
        zIndex: 70,
        width: 'calc(100% - 32px)',
        maxWidth: 520,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 12px 12px 14px',
        borderRadius: 12,
        background: 'var(--card)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-2)',
      }}
    >
      <Glyph icon={BellRing} tone="red" size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{copy[mode].title}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.35 }}>
          {error || copy[mode].line}
        </div>
      </div>
      {mode === 'ask' && (
        <button className="btn btn--primary btn--sm" onClick={() => void turnOn()} disabled={busy}>
          {busy ? 'Turning on…' : 'Turn on'}
        </button>
      )}
      <button className="btn btn--ghost btn--sm" onClick={dismiss} aria-label="Not now">
        {mode === 'ask' ? 'Not now' : <X size={16} />}
      </button>
    </div>
  )
}
