import { useRef } from 'react'
import { applyPinInput } from '../lib/pin'

/** Four single-digit boxes, the same as on the login screen. */
export default function PinBoxes({ label, value, onChange, autoFocus }: { label: string; value: string[]; onChange: (next: string[]) => void; autoFocus?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function setDigit(i: number, raw: string) {
    const { next, focus } = applyPinInput(value, i, raw)
    if (next !== value) onChange(next)
    if (focus !== null) refs.current[focus]?.focus()
  }

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="pin" role="group" aria-label={label}>
        {value.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            aria-label={`${label}, digit ${i + 1}`}
            value={d}
            autoFocus={autoFocus && i === 0}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus()
            }}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
    </div>
  )
}
