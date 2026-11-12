import { useEffect, useRef, useState } from 'react'
import type { HeadType } from '../lib/types'

export interface HeadOption {
  id: string
  name: string
  kind: HeadType
}

/**
 * A dropdown for account heads. The name is shown as plain text and only the bracket after it is coloured:
 * green "(Income)" or red "(Expense)". A native select cannot colour part of an option, so this draws its own list.
 */
export default function HeadSelect({ value, onChange, options, placeholder }: { value: string; onChange: (id: string) => void; options: HeadOption[]; placeholder: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const chosen = options.find((o) => o.id === value)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const label = (o: HeadOption) => (
    <>
      {o.name} <span className={`hsel__tag hsel__tag--${o.kind}`}>({o.kind === 'income' ? 'Income' : 'Expense'})</span>
    </>
  )

  return (
    <div className="hsel" ref={box}>
      <button type="button" className="field__control native-select hsel__btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {chosen ? label(chosen) : placeholder}
      </button>
      {open && (
        <div className="hsel__list" role="listbox">
          <button type="button" role="option" aria-selected={!value} className="hsel__opt hsel__opt--none" onClick={() => { onChange(''); setOpen(false) }}>
            {placeholder}
          </button>
          {options.map((o) => (
            <button key={o.id} type="button" role="option" aria-selected={o.id === value} className={`hsel__opt ${o.id === value ? 'is-on' : ''}`} onClick={() => { onChange(o.id); setOpen(false) }}>
              {label(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
