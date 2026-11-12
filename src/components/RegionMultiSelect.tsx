import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react'
import { matches } from '../lib/search'
import type { Region } from '../lib/types'

export interface RegionMultiSelectProps {
  regions: Region[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  loading?: boolean
  placeholder?: string
  error?: string
  disabled?: boolean
}

export default function RegionMultiSelect({
  regions,
  selectedIds,
  onChange,
  loading = false,
  placeholder = 'Select regions to assign…',
  error,
  disabled = false,
}: RegionMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => searchInputRef.current?.focus(), 20)
      return () => window.clearTimeout(timer)
    } else {
      setQ('')
    }
  }, [open])

  const selectedSet = new Set(selectedIds)
  const selectedRegions = regions.filter((r) => selectedSet.has(r.id))

  const filteredRegions = q.trim()
    ? regions.filter((r) => matches(q, r.name, r.code, r.adminName))
    : regions

  const allVisibleSelected =
    filteredRegions.length > 0 && filteredRegions.every((r) => selectedSet.has(r.id))

  function toggleRegion(id: string) {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((item) => item !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  function removeRegion(id: string) {
    onChange(selectedIds.filter((item) => item !== id))
  }

  function selectAll() {
    if (q.trim()) {
      const next = new Set(selectedIds)
      filteredRegions.forEach((r) => next.add(r.id))
      onChange(Array.from(next))
    } else {
      onChange(regions.map((r) => r.id))
    }
  }

  function clearAll() {
    onChange([])
  }

  const triggerText = () => {
    if (loading) return 'Checking eligible regions…'
    if (regions.length === 0) return 'No eligible regions available'
    if (selectedIds.length === 0) return placeholder
    if (selectedIds.length === 1 && selectedRegions[0]) {
      const r = selectedRegions[0]
      return `${r.name}${r.code ? ` (${r.code})` : ''}`
    }
    return `${selectedIds.length} regions selected`
  }

  return (
    <div className={`msel ${error ? 'field--invalid' : ''}`} ref={boxRef}>
      <button
        type="button"
        className={`field__control msel__btn ${error ? 'field__control--error' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled || loading || regions.length === 0}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={`msel__val ${selectedIds.length === 0 ? 'msel__val--placeholder' : ''}`}>
          {triggerText()}
        </span>

        <span className="msel__btn-right">
          {selectedIds.length > 0 && (
            <>
              <span className="chip chip--gold msel__pill">{selectedIds.length}</span>
              <button
                type="button"
                className="msel__clear-btn"
                title="Clear selection"
                aria-label="Clear selection"
                onClick={(e) => {
                  e.stopPropagation()
                  clearAll()
                }}
              >
                <X size={13} />
              </button>
            </>
          )}
          {loading ? (
            <Loader2 size={16} className="spin" style={{ color: 'var(--ink-mute)' }} />
          ) : (
            <ChevronDown size={17} className={`msel__chevron ${open ? 'is-open' : ''}`} />
          )}
        </span>
      </button>

      {/* Selected regions rendered as removable chips */}
      {selectedRegions.length > 0 && (
        <div className="msel__chips" aria-label="Selected regions">
          {selectedRegions.map((region) => (
            <span key={region.id} className="chip chip--gold msel__chip">
              <span className="msel__chip-label">
                {region.name}
                {region.code ? ` (${region.code})` : ''}
              </span>
              <button
                type="button"
                className="chip__x"
                onClick={(e) => {
                  e.stopPropagation()
                  removeRegion(region.id)
                }}
                aria-label={`Remove ${region.name}`}
                title={`Remove ${region.name}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown Menu */}
      {open && (
        <div className="msel__menu" role="listbox" aria-multiselectable="true">
          {/* Search bar */}
          <div className="msel__search">
            <Search size={15} style={{ color: 'var(--ink-mute)', flexShrink: 0 }} aria-hidden />
            <input
              ref={searchInputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search eligible regions…"
              aria-label="Search eligible regions"
              autoComplete="off"
            />
            {q && (
              <button
                type="button"
                className="msel__clear-btn"
                onClick={() => setQ('')}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="msel__toolbar">
            <span className="msel__count">
              {selectedIds.length} of {regions.length} selected
            </span>
            <div className="msel__actions">
              <button
                type="button"
                className="link-btn"
                onClick={selectAll}
                disabled={allVisibleSelected || regions.length === 0}
                style={{ opacity: allVisibleSelected || regions.length === 0 ? 0.45 : 1 }}
              >
                {q.trim() ? `Select matching (${filteredRegions.length})` : 'Select all'}
              </button>
              {selectedIds.length > 0 && (
                <button type="button" className="link-btn" onClick={clearAll}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="msel__list">
            {loading && (
              <div className="msel__empty">
                <Loader2 size={18} className="spin" />
                <span>Loading eligible regions…</span>
              </div>
            )}

            {!loading && regions.length === 0 && (
              <div className="msel__empty">
                <span>Every active region already has an open subscription.</span>
              </div>
            )}

            {!loading && regions.length > 0 && filteredRegions.length === 0 && (
              <div className="msel__empty">
                <span>No regions matching “{q}”.</span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setQ('')}
                  style={{ fontSize: '13px', marginTop: '2px' }}
                >
                  Clear search
                </button>
              </div>
            )}

            {!loading &&
              filteredRegions.map((region) => {
                const isSelected = selectedSet.has(region.id)
                return (
                  <div
                    key={region.id}
                    role="option"
                    aria-selected={isSelected}
                    className={`msel__opt ${isSelected ? 'is-on' : ''}`}
                    onClick={() => toggleRegion(region.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <div className="pick__who" style={{ flex: 1, minWidth: 0 }}>
                      <div className="msel__opt-head">
                        <b>{region.name}</b>
                        {region.code && <span className="msel__code-badge">{region.code}</span>}
                      </div>
                      {region.adminName && <small>Admin: {region.adminName}</small>}
                    </div>
                    {isSelected && <Check size={16} className="msel__opt-check" />}
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
