import { Search, X } from 'lucide-react'

/** The search box at the top of a list. The list filters as you type. */
export function ListSearch({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (next: string) => void; placeholder?: string }) {
  return (
    <label className="lsearch">
      <Search size={16} aria-hidden />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoComplete="off" />
      {value && (
        <button type="button" className="lsearch__x" onClick={() => onChange('')} aria-label="Clear search">
          <X size={15} />
        </button>
      )}
    </label>
  )
}

/** Shown under the search box when nothing matches. */
export function NoMatch({ query }: { query: string }) {
  return (
    <div className="empty">
      <b>No results for “{query.trim()}”.</b>
      Try a different word.
    </div>
  )
}
