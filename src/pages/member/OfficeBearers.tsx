import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Award, ChevronDown, Mail, MessageCircle, Phone } from 'lucide-react'
import { Avatar, Glyph, PageHead } from '../../components/ui'
import { BEARER_GROUPS } from '../../data/bearers'
import { useAuth } from '../../lib/auth'
import { DESIGNATIONS } from '../../data/seed'
import { designationsOf } from '../../lib/designations'
import { useDB } from '../../lib/store'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import type { Member } from '../../lib/types'

/* Within a role, follow the designation order, then A to Z. */
const rank = (m: Member) => {
  const i = DESIGNATIONS.indexOf(m.designation)
  return i === -1 ? DESIGNATIONS.length : i
}
const byDesignation = (a: Member, b: Member) => rank(a) - rank(b) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

export default function OfficeBearers() {
  const { member, chapter } = useAuth()
  const db = useDB()
  const [openKey, setOpenKey] = useState('')
  const [q, setQ] = useState('')

  if (!member) return null
  const everyone = db.members.filter((m) => m.chapterId === member.chapterId)
  const mates = everyone.filter((m) => matches(q, m.name, m.organisation, m.designation, m.category, m.mobile, m.profile.email))
  /* Only the roles the region has created (or that someone still holds), in the standard order. */
  const created = designationsOf(db, member.regionId, member.chapterId).filter((d) => d.isActive).map((d) => d.name)
  const allGroups = BEARER_GROUPS.filter((g) => created.some((n) => g.match(n)) || everyone.some((m) => g.match(m.designation)))
  const total = allGroups.reduce((n, g) => n + everyone.filter((m) => g.match(m.designation)).length, 0)
  /* while searching, only the roles that have a match are listed */
  const groups = q.trim() ? allGroups.filter((g) => mates.some((m) => g.match(m.designation))) : allGroups

  return (
    <div className="page">
      <PageHead
        eyebrow="Chapter"
        icon={Award}
        tone="gold"
        title="Office Bearers"
        subtitle={`${total} office ${total === 1 ? 'bearer' : 'bearers'} of ${chapter?.name ?? 'your chapter'}. Tap a role for full details.`}
      />

      <ListSearch value={q} onChange={setQ} placeholder="Search office bearers" />
      {q && groups.length === 0 && <NoMatch query={q} />}

      <div className="acc">
        {groups.map((g, i) => {
          const people = mates.filter((m) => g.match(m.designation)).sort(byDesignation)
          const open = openKey === g.key
          return (
            <section className={`acc__item ${open ? 'is-open' : ''}`} key={g.key} data-rank={allGroups.indexOf(g)} style={{ '--s': Math.min(allGroups.indexOf(g), 4) } as CSSProperties}>
              <h2>
                <button
                  type="button"
                  className="acc__head"
                  id={`acc-head-${g.key}`}
                  aria-expanded={open}
                  aria-controls={`acc-panel-${g.key}`}
                  onClick={() => setOpenKey(open ? '' : g.key)}
                >
                  <span className="acc__no">{i + 1}</span>
                  <Glyph icon={g.icon} tone={g.tone} size={52} />
                  <span className="acc__title">
                    <b>{g.title}</b>
                    <small>{people.length ? people.map((m) => m.name).join(', ') : 'Not assigned yet'}</small>
                  </span>
                  <span className={`acc__count ${people.length ? '' : 'is-zero'}`}>{people.length}</span>
                  <ChevronDown className="acc__chev" size={22} aria-hidden />
                </button>
              </h2>

              <div className="acc__panel" id={`acc-panel-${g.key}`} role="region" aria-labelledby={`acc-head-${g.key}`}>
                <div className="acc__inner">
                  {people.length === 0 ? (
                    <p className="acc__empty">No one has been assigned as {g.title} yet.</p>
                  ) : (
                    <ul className="bearers">
                      {people.map((m) => {
                        const digits = m.mobile.replace(/\D/g, '')
                        return (
                          <li className="bcard" key={m.id}>
                            <Link className="bcard__top" to={`/directory/${m.id}`}>
                              <Avatar name={m.name} photo={m.photo} size={64} />
                              <span className="bcard__who">
                                <b>{m.name}</b>
                                <span>{m.organisation || '—'}</span>
                              </span>
                            </Link>
                            <div className="chips">
                              <span className="chip chip--red">{m.designation}</span>
                              {m.category && <span className="chip chip--gold">{m.category}</span>}
                            </div>
                            <dl className="bcard__kv">
                              <div>
                                <dt>Mobile</dt>
                                <dd>{m.mobile}</dd>
                              </div>
                              <div>
                                <dt>Email</dt>
                                <dd>{m.profile.email || '—'}</dd>
                              </div>
                            </dl>
                            <div className="bcard__acts">
                              <a className="qa" href={`tel:+91${digits}`}>
                                <Phone size={15} /> Call
                              </a>
                              <a className="qa" href={`https://wa.me/91${digits}`} target="_blank" rel="noreferrer">
                                <MessageCircle size={15} /> WhatsApp
                              </a>
                              {m.profile.email ? (
                                <a className="qa" href={`mailto:${m.profile.email}`}>
                                  <Mail size={15} /> Email
                                </a>
                              ) : (
                                <span className="qa qa--off" aria-disabled>
                                  <Mail size={15} /> Email
                                </span>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
