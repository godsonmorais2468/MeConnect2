import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Building2, ChevronRight, Mail, MessageCircle, Phone, Search, SlidersHorizontal, X } from 'lucide-react'
import { Avatar } from './ui'
import { indexLetter } from '../lib/format'
import { percent } from '../lib/profile'
import type { Member } from '../lib/types'

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
const EMPTY = { name: '', mobile: '', company: '', category: '', designation: '' }

const has = (value: string, query: string) => value.toLowerCase().includes(query.trim().toLowerCase())

/** A thin progress ring drawn around the open contact's photo. */
function PctRing({ pct, size = 124, stroke = 5 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg className="ab__ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle className="ab__ring-bg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
      <circle className="ab__ring-fg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct) / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  )
}

/**
 * A chapter's members as an address book, shared by the member E-Directory and the Super Admin's view of a chapter:
 * a search bar and category chips on top, the A to Z list of people, and the open contact beside it (a sheet on phones).
 * With `linkTo` the contact has a button that opens the member's own page.
 */
export default function MemberDirectory({ members, linkTo }: { members: Member[]; linkTo?: (m: Member) => string }) {
  const [f, setF] = useState(EMPTY)
  const [letter, setLetter] = useState('')
  /* the filters start open on wide screens and folded on phones, so the list is the first thing you see there */
  const [showMore, setShowMore] = useState(() => window.matchMedia('(min-width: 900px)').matches)
  const [pickedId, setPickedId] = useState('')
  const [sheet, setSheet] = useState(false)

  const all = useMemo(() => [...members].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [members])

  const categories = useMemo(() => [...new Set(all.map((m) => m.category).filter(Boolean))].sort(), [all])
  const designations = useMemo(() => [...new Set(all.map((m) => m.designation).filter(Boolean))].sort(), [all])

  const matches = all.filter(
    (m) =>
      has(m.name, f.name) &&
      m.mobile.includes(f.mobile.trim()) &&
      has(m.organisation, f.company) &&
      (!f.category || m.category === f.category) &&
      (!f.designation || m.designation === f.designation),
  )
  const available = new Set(matches.map((m) => indexLetter(m.name)))
  const active = letter && available.has(letter) ? letter : ''
  const list = active ? matches.filter((m) => indexLetter(m.name) === active) : matches
  const moreCount = [f.mobile, f.company, f.category, f.designation].filter(Boolean).length
  const filtering = Object.values(f).some(Boolean) || !!active

  /* Names are already sorted, so each letter's members sit together. */
  const groups: { letter: string; members: Member[] }[] = []
  for (const m of list) {
    const l = indexLetter(m.name)
    const last = groups[groups.length - 1]
    if (last && last.letter === l) last.members.push(m)
    else groups.push({ letter: l, members: [m] })
  }

  /* The open contact: the one picked, else the first on the list. */
  const current = list.find((m) => m.id === pickedId) ?? list[0]
  const sheetOpen = sheet && !!current

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  const set = (key: keyof typeof EMPTY) => (value: string) => setF((cur) => ({ ...cur, [key]: value }))
  const digits = current?.mobile.replace(/\D/g, '') ?? ''
  const email = current?.profile?.email ?? ''
  const pct = current ? percent(current) : 0

  return (
    <div className="ab" data-sheet={sheetOpen ? "open" : undefined}>
      <div className="ab__bar">
        <label className="ab__search">
          <Search size={19} aria-hidden />
          <input value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder="Search people by name" aria-label="Search by name" />
          {f.name && (
            <button type="button" className="ab__x" onClick={() => set('name')('')} aria-label="Clear name">
              <X size={15} />
            </button>
          )}
        </label>
        <button type="button" className={`ab__filters${showMore ? ' is-on' : ''}`} onClick={() => setShowMore((o) => !o)} aria-expanded={showMore}>
          <SlidersHorizontal size={17} />
          <span>Filters</span>
          {moreCount > 0 && <i className="ab__count">{moreCount}</i>}
        </button>
      </div>

      {showMore && (
        <section className="ab__more" aria-label="More filters">
          <label className="field">
            <span className="field__label">Mobile no</span>
            <input className="field__control" inputMode="numeric" value={f.mobile} onChange={(e) => set('mobile')(e.target.value.replace(/\D/g, ''))} placeholder="Search mobile" />
          </label>
          <label className="field">
            <span className="field__label">Company name</span>
            <input className="field__control" value={f.company} onChange={(e) => set('company')(e.target.value)} placeholder="Search company" />
          </label>
          <label className="field">
            <span className="field__label">Category</span>
            <select className="field__control native-select" value={f.category} onChange={(e) => set('category')(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Designation</span>
            <select className="field__control native-select" value={f.designation} onChange={(e) => set('designation')(e.target.value)}>
              <option value="">All designations</option>
              {designations.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          {filtering && (
            <button
              type="button"
              className="btn btn--line btn--sm ab__clear"
              onClick={() => {
                setF(EMPTY)
                setLetter('')
              }}
            >
              <X size={14} /> Clear all
            </button>
          )}
        </section>
      )}

      <div className="ab__main">
        <section className="ab__list" aria-label="Members">
          {groups.length === 0 ? (
            <div className="empty">
              <b>No members found.</b>
              {all.length === 0 ? 'This chapter has no members yet.' : 'Try changing or clearing the filters.'}
            </div>
          ) : (
            groups.map((g) => (
              <div className="ab__group" key={g.letter}>
                <h3 className="ab__letter">{g.letter}</h3>
                <ul>
                  {g.members.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className={`ab__row${current?.id === m.id ? ' is-on' : ''}`}
                        onClick={() => {
                          setPickedId(m.id)
                          setSheet(true)
                        }}
                        aria-pressed={current?.id === m.id}
                      >
                        <Avatar name={m.name} photo={m.photo} size={46} />
                        <span className="ab__who">
                          <b>{m.name}</b>
                          <small>{[m.organisation, m.designation].filter(Boolean).join(' · ') || '—'}</small>
                        </span>
                        <ChevronRight size={17} className="ab__go" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <nav className="ab__index" aria-label="Jump to letter">
          <button type="button" className={`ab__all${active ? '' : ' is-on'}`} onClick={() => setLetter('')} aria-pressed={!active}>
            All
          </button>
          {LETTERS.map((l) => (
            <button key={l} type="button" className={active === l ? 'is-on' : ''} disabled={!available.has(l)} onClick={() => setLetter(active === l ? '' : l)} aria-label={`Names starting with ${l}`} aria-pressed={active === l}>
              {l}
            </button>
          ))}
        </nav>

        <div className={`ab__scrim${sheetOpen ? ' is-open' : ''}`} onClick={() => setSheet(false)} aria-hidden />
        <aside className={`ab__detail${sheetOpen ? ' is-open' : ''}`} aria-label="Contact" aria-hidden={!current}>
          {current ? (
            <>
              <button type="button" className="ab__close" onClick={() => setSheet(false)} aria-label="Close">
                <X size={18} />
              </button>
              <i className="ab__grip" aria-hidden />
              <div className="ab__id">
                <span className="ab__photo">
                  <PctRing pct={pct} />
                  <span className="ab__photo-in">
                    <Avatar name={current.name} photo={current.photo} size={96} />
                  </span>
                </span>
                <h2>{current.name}</h2>
                <p className="ab__role">{current.designation || 'Member'}</p>
                <div className="chips">
                  {current.category && <span className="chip chip--gold">{current.category}</span>}
                  <span className="chip">{pct}% profile</span>
                </div>
              </div>

              <dl className="ab__facts">
                <div>
                  <dt>
                    <Building2 size={15} /> Company
                  </dt>
                  <dd>{current.organisation || '—'}</dd>
                </div>
                <div>
                  <dt>
                    <Phone size={15} /> Mobile
                  </dt>
                  <dd>{current.mobile || '—'}</dd>
                </div>
                {email && (
                  <div>
                    <dt>
                      <Mail size={15} /> Email
                    </dt>
                    <dd>{email}</dd>
                  </div>
                )}
              </dl>

              <div className="ab__acts">
                {digits && (
                  <a className="ab__act ab__act--call" href={`tel:+91${digits}`}>
                    <Phone size={18} /> Call
                  </a>
                )}
                {digits && (
                  <a className="ab__act ab__act--wa" href={`https://wa.me/91${digits}`} target="_blank" rel="noreferrer">
                    <MessageCircle size={18} /> WhatsApp
                  </a>
                )}
                {email && (
                  <a className="ab__act ab__act--mail" href={`mailto:${email}`}>
                    <Mail size={18} /> Email
                  </a>
                )}
              </div>

              {linkTo && (
                <Link to={linkTo(current)} className="btn btn--primary ab__open">
                  View full profile <ArrowUpRight size={17} />
                </Link>
              )}
            </>
          ) : (
            <p className="ab__none">Pick a person to see their details.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
