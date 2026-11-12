import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { MapPin } from 'lucide-react'
import { placeLocation, placesEnabled, suggestPlaces } from '../lib/googleMaps'
import type { PlaceSuggestion } from '../lib/googleMaps'
import { useDismiss } from '../lib/hooks'

/**
 * A venue box that suggests places as you type (Google Places). Picking one fills the venue name and calls `onPick` with
 * the place's latitude and longitude. Without a Google key it is an ordinary text box.
 */
export default function VenueSearch({
  value,
  onChange,
  onPick,
  placeholder,
}: {
  value: string
  onChange: (text: string) => void
  onPick: (place: { text: string; lat: number; lng: number }) => void
  placeholder?: string
}) {
  const [items, setItems] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const box = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  /* only the newest search may show its answer */
  const latest = useRef(0)
  useDismiss(box, open, () => setOpen(false))

  function type(text: string) {
    onChange(text)
    setActive(-1)
    window.clearTimeout(timer.current)
    latest.current += 1
    if (!placesEnabled || text.trim().length < 3) {
      setItems([])
      setOpen(false)
      return
    }
    const mine = latest.current
    timer.current = window.setTimeout(async () => {
      const found = await suggestPlaces(text.trim())
      if (mine !== latest.current) return
      setItems(found)
      setOpen(found.length > 0)
    }, 250)
  }

  async function pick(place: PlaceSuggestion) {
    latest.current += 1
    window.clearTimeout(timer.current)
    setOpen(false)
    setItems([])
    onChange(place.text)
    const spot = await placeLocation(place.placeId)
    if (spot) onPick({ text: place.text, ...spot })
  }

  function keys(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      void pick(items[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="vsearch" ref={box}>
      <input
        className="field__control"
        value={value}
        onChange={(e) => type(e.target.value)}
        onKeyDown={keys}
        onFocus={() => items.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <ul className="vsearch__list" role="listbox">
          {items.map((p, i) => (
            <li key={p.placeId} role="option" aria-selected={i === active}>
              <button type="button" className={`vsearch__row ${i === active ? 'is-on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => void pick(p)}>
                <MapPin size={16} />
                <span>
                  <b>{p.main}</b>
                  {p.secondary && <small>{p.secondary}</small>}
                </span>
              </button>
            </li>
          ))}
          <li className="vsearch__credit">Powered by Google</li>
        </ul>
      )}
    </div>
  )
}
