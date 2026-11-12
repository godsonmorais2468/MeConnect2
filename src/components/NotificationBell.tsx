import { useCallback, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LucideProps } from 'lucide-react'
import { Bell, BellOff, CalendarCheck, CalendarClock, CheckCheck, IndianRupee, ListChecks, PartyPopper, UserRound } from 'lucide-react'
import { useDismiss } from '../lib/hooks'
import { markRead } from '../lib/notifications'
import type { Note, NoteKind } from '../lib/notifications'
import { Glyph } from './ui'

const ICONS: Record<NoteKind, ComponentType<LucideProps>> = {
  attendance: CalendarCheck,
  meeting: CalendarClock,
  due: IndianRupee,
  wish: PartyPopper,
  profile: UserRound,
  poll: ListChecks,
}

/** Bell in the top corner. The number is how many notifications have not been opened yet. */
export default function NotificationBell({ notes, memberId }: { notes: Note[]; memberId: string }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  const unread = notes.filter((n) => !n.read)

  function openNote(n: Note) {
    markRead(memberId, [n.id])
    setOpen(false)
    navigate(n.to)
  }

  return (
    <div className="bell" ref={ref}>
      <button
        type="button"
        className={`bell__btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unread.length ? `Notifications, ${unread.length} unread` : 'Notifications'}
      >
        <Bell size={22} />
        {unread.length > 0 && <b className="bell__badge">{unread.length > 9 ? '9+' : unread.length}</b>}
      </button>

      {open && <div className="notes__scrim" onClick={close} aria-hidden />}

      {open && (
        <section className="notes" aria-label="Notifications">
          <header className="notes__head">
            <h2>
              Notifications
              {notes.length > 0 && <span>{notes.length}</span>}
            </h2>
            <button type="button" className="notes__all" disabled={unread.length === 0} onClick={() => markRead(memberId, notes.map((n) => n.id))}>
              <CheckCheck size={15} /> Mark all as read
            </button>
          </header>

          {notes.length === 0 ? (
            <div className="notes__empty">
              <BellOff size={26} />
              <b>You are all caught up</b>
              New notifications will appear here.
            </div>
          ) : (
            <ul className="notes__list">
              {notes.map((n) => (
                <li key={n.id}>
                  <button type="button" className={`note ${n.read ? '' : 'is-unread'}`} onClick={() => openNote(n)}>
                    <Glyph icon={ICONS[n.kind]} tone={n.tone} size={42} />
                    <span className="note__body">
                      <b>{n.title}</b>
                      <span>{n.text}</span>
                    </span>
                    {!n.read && <i className="note__dot" aria-label="Unread" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
