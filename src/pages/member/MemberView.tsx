import { linkHref } from '../../lib/links'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, MessageCircle, Phone, X } from 'lucide-react'
import { Avatar, Glyph } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { fmtDayMonth } from '../../lib/dayMonth'
import { fmtDate } from '../../lib/format'
import { useDB } from '../../lib/store'

const linkOrText = (value: string) => {
  const href = linkHref(value)
  return href ? <a href={href} target="_blank" rel="noreferrer">{value}</a> : value
}

export default function MemberView() {
  const { id, regionId, chapterId } = useParams()
  const { member: me } = useAuth()
  const db = useDB()
  const [photoOpen, setPhotoOpen] = useState(false)

  /* a Super Admin opens a member from a chapter's list (the chapter is in the address); a member opens one from their own E-Directory */
  const fromChapter = chapterId ? { to: `/admin/regions/${regionId}/chapters/${chapterId}`, label: 'Members' } : { to: '/directory', label: 'E-Directory' }
  const m = db.members.find((x) => x.id === id && x.chapterId === (chapterId ?? me?.chapterId))
  if (!m) {
    return (
      <div className="page">
        <Link className="btn btn--line btn--sm back" to={fromChapter.to}>
          <ArrowLeft size={15} /> {fromChapter.label}
        </Link>
        <div className="empty">
          <b>Member not found.</b>
          They may belong to a different chapter.
        </div>
      </div>
    )
  }

  const chapter = db.chapters.find((c) => c.id === m.chapterId)
  const region = db.regions.find((r) => r.id === m.regionId)
  const p = m.profile
  const digits = m.mobile.replace(/\D/g, '')

  const rows: [string, ReactNode][] = [
    ['Name', m.name],
    ['Company name', m.organisation || '—'],
    ['Designation', m.designation],
    ['Category', m.category || '—'],
    ['Mobile no', m.mobile],
    ['Email', p.email || '—'],
    ['Website', p.website ? linkOrText(p.website) : '—'],
    ['Social media', p.social ? linkOrText(p.social) : '—'],
    ['Birthday', fmtDayMonth(p.dob) || '—'],
    ['Joined ME-CONNECT', p.dateOfJoining ? fmtDate(p.dateOfJoining, { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
    ['Married', p.married === 'yes' ? 'Yes' : p.married === 'no' ? 'No' : '—'],
  ]
  if (p.married === 'yes') {
    rows.push(['Spouse name', p.spouse || '—'], ['Anniversary', fmtDayMonth(p.anniversary) || '—'])
  }
  rows.push(['Chapter', chapter?.name ?? '—'], ['Region', region?.name ?? '—'])

  return (
    <div className="page">
      <Link className="btn btn--line btn--sm back" to={fromChapter.to}>
        <ArrowLeft size={15} /> {fromChapter.label}
      </Link>

      <div className="mv">
        <section className="cover">
          <div className="cover__art" />
          <div className="cover__head">
            {m.photo ? (
              <button type="button" className="cover__photo" onClick={() => setPhotoOpen(true)} aria-label={`View ${m.name}'s profile picture`}>
                <Avatar name={m.name} photo={m.photo} size={112} />
              </button>
            ) : (
              <Avatar name={m.name} photo={m.photo} size={112} />
            )}
            <div className="cover__who">
              <h1>{m.name}</h1>
              <p>
                {m.designation}
                {m.organisation && ` · ${m.organisation}`}
              </p>
            </div>
          </div>
          {m.category && (
            <div className="cover__chips chips">
              <span className="chip chip--gold">{m.category}</span>
              {chapter && <span className="chip">{chapter.name}</span>}
            </div>
          )}
          <dl className="kv">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <aside className="mv__side" aria-label="Contact">
          <a className="act" href={`tel:+91${digits}`}>
            <Glyph icon={Phone} tone="green" size={48} />
            <span>
              <b>Call</b>
              <small>{m.mobile}</small>
            </span>
          </a>
          <a className="act" href={`https://wa.me/91${digits}`} target="_blank" rel="noreferrer">
            <Glyph icon={MessageCircle} tone="green" size={48} />
            <span>
              <b>WhatsApp</b>
              <small>Send a message</small>
            </span>
          </a>
          {p.email ? (
            <a className="act" href={`mailto:${p.email}`}>
              <Glyph icon={Mail} tone="wine" size={48} />
              <span>
                <b>Email</b>
                <small>{p.email}</small>
              </span>
            </a>
          ) : (
            <div className="act act--off" aria-disabled>
              <Glyph icon={Mail} tone="steel" size={48} />
              <span>
                <b>Email</b>
                <small>No email added</small>
              </span>
            </div>
          )}
        </aside>
      </div>

      {photoOpen && m.photo && <PhotoViewer name={m.name} photo={m.photo} onClose={() => setPhotoOpen(false)} />}
    </div>
  )
}

/** The profile picture at full size, over the page. Closes on the X, a tap outside, or Escape. */
function PhotoViewer({ name, photo, onClose }: { name: string; photo: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scan" role="dialog" aria-modal="true" aria-label={`${name}'s profile picture`} onClick={onClose}>
      <div className="scan__card photo" onClick={(e) => e.stopPropagation()}>
        <div className="scan__head">
          <h2>{name}</h2>
          <button type="button" className="scan__x" onClick={onClose} aria-label="Close picture">
            <X size={18} />
          </button>
        </div>
        <img className="photo__img" src={photo} alt={`${name}'s profile picture`} />
      </div>
    </div>
  )
}
