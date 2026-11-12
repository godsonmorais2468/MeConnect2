import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { matches } from '../lib/search'

export interface SearchSelectOption {
  id: string
  name: string
  sub?: string
}

export interface SearchSelectProps {
  value: string
  onChange: (id: string) => void
  options: SearchSelectOption[]
  placeholder: string
  searchable?: boolean
  searchPlaceholder?: string
  disabled?: boolean
  loading?: boolean
  error?: boolean
  allowEmpty?: boolean
  emptyOptionLabel?: string
  ariaLabel?: string
}

/**
 * A single-choice dropdown drawn to match the in-app selects (the native select
 * cannot be styled or searched). Set `searchable={false}` for a short list.
 */
export default function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  searchable = true,
  searchPlaceholder = 'Search',
  disabled = false,
  loading = false,
  error = false,
  allowEmpty = true,
  emptyOptionLabel,
  ariaLabel,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const chosen = options.find((o) => o.id === value)

  useEffect(() => {
    if (!open) return
    // Use pointerdown + touchstart to reliably close on outside tap across all
    // mobile browsers — older iOS/Android fire mousedown, but newer ones (iOS 17+,
    // modern Android Chrome) may not fire mousedown on non-interactive elements.
    const away = (e: Event) => {
      const target = (e as MouseEvent).target as Node
      if (box.current && !box.current.contains(target)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away, { passive: true })
    document.addEventListener('touchstart', away, { passive: true })
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('touchstart', away)
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  useEffect(() => {
    if (!open || !searchable) return
    const id = window.setTimeout(() => search.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, searchable])

  const shown = searchable ? options.filter((o) => matches(q, o.name, o.sub)) : options
  const label = (o: SearchSelectOption) => (o.sub ? `${o.name} (${o.sub})` : o.name)

  function toggle() {
    if (disabled || loading) return
    if (open) {
      setOpen(false)
    } else {
      if (searchable) setQ('')
      setOpen(true)
    }
  }

  // onPointerDown fires before onClick and is more reliable on modern mobile
  // Safari/Chrome — avoids cases where a fast tap is interpreted as a scroll
  // and the click event is swallowed, leaving the dropdown stuck open.
  function choosePointer(e: React.PointerEvent, id: string) {
    e.preventDefault()
    onChange(id)
    setOpen(false)
  }

  function choose(id: string) {
    onChange(id)
    setOpen(false)
  }

  return (
    <div className={`hsel ${error ? 'field--invalid' : ''}`} ref={box}>
      <button
        type="button"
        className={`field__control native-select hsel__btn ${error ? 'field__control--error' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled || loading}
        onClick={toggle}
      >
        {loading ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--ink-mute)' }}>
            <Loader2 size={15} className="spin" /> {placeholder || 'Loading…'}
          </span>
        ) : chosen ? (
          label(chosen)
        ) : (
          placeholder
        )}
      </button>

      {open && (
        <div className="hsel__list" role="listbox">
          {searchable && (
            <div className="pick__search ssel__search" style={{ position: 'relative' }}>
              <Search size={15} aria-hidden />
              <input
                ref={search}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (shown.length) choose(shown[0].id)
                  }
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  className="chip__x"
                  style={{ marginLeft: 'auto', flexShrink: 0 }}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {allowEmpty && (
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={`hsel__opt hsel__opt--none ${!value ? 'is-on' : ''}`}
              onPointerDown={(e) => choosePointer(e, '')}
              onClick={() => choose('')}
            >
              {emptyOptionLabel ?? placeholder}
            </button>
          )}

          {searchable && shown.length === 0 && <div className="hsel__none">No match for “{q}”.</div>}

          {shown.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === value}
              className={`hsel__opt ${o.id === value ? 'is-on' : ''}`}
              onPointerDown={(e) => choosePointer(e, o.id)}
              onClick={() => choose(o.id)}
            >
              {label(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

