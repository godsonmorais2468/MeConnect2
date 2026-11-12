import { useCallback, useRef, useState } from 'react'
import { Check, Moon, Palette, Sun } from 'lucide-react'
import { useDismiss } from '../lib/hooks'
import { THEMES, getMode, getTheme, setMode, setTheme, type Mode, type ThemeId } from '../lib/theme'

/* A palette button for the title bar: pick the accent colour and dark or light mode for the whole app. */
export default function ThemeMenu() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<ThemeId>(getTheme)
  const [mode, setModeState] = useState<Mode>(getMode)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  const pick = (id: ThemeId) => {
    setTheme(id)
    setCurrent(id)
  }
  const pickMode = (m: Mode) => {
    setMode(m)
    setModeState(m)
  }

  return (
    <div className="themer" ref={ref}>
      <button type="button" className="icon-btn themer__btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true" aria-label="Change colour theme" title="Colour theme">
        <Palette size={19} />
      </button>
      {open && <div className="notes__scrim" onClick={close} aria-hidden />}

      {open && (
        <div className="pop themer__pop" role="menu" aria-label="Colour theme">
          <div className="themer__head">Mode</div>
          <div className="themer__modes" role="radiogroup" aria-label="Mode">
            <button type="button" role="radio" aria-checked={mode === 'dark'} className={`themer__mode${mode === 'dark' ? ' is-on' : ''}`} onClick={() => pickMode('dark')}>
              <Moon size={15} /> Dark
            </button>
            <button type="button" role="radio" aria-checked={mode === 'light'} className={`themer__mode${mode === 'light' ? ' is-on' : ''}`} onClick={() => pickMode('light')}>
              <Sun size={15} /> Light
            </button>
          </div>
          <div className="themer__head">Colour</div>
          <div className="themer__grid">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={current === t.id}
                className={`themer__opt${current === t.id ? ' is-on' : ''}`}
                onClick={() => pick(t.id)}
                style={{ '--sw': t.swatch, '--sw-hi': t.swatchHi } as React.CSSProperties}
              >
                <span className="themer__dot">{current === t.id && <Check size={14} strokeWidth={3} />}</span>
                <span className="themer__name">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
