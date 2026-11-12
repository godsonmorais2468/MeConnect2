import { useState, useEffect } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import type { LucideProps } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Award, BookUser, CalendarCheck, CalendarClock, ChevronDown, ChevronRight, ClipboardList, FileChartColumn, HandCoins, IndianRupee, Landmark, ListChecks, PartyPopper, QrCode as QrCodeIcon, Settings, UserCheck, Users, X } from 'lucide-react'
import { Avatar, Glyph } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { OPENS_BEFORE_MIN, currentMeeting, phaseOf, windowOf } from '../../lib/attendance'
import { totalOf } from '../../lib/dues'
import { hasAttendancePermission, hasVisitorHostPermission, isHeadTable } from '../../lib/designations'
import { fmtDate, fmtTime, firstName, inr } from '../../lib/format'
import { CoordinatorQr, MeetingBrief } from './Attendance'
import { useNow } from '../../lib/hooks'
import { fetchDueList, syncWithBackend, useDB } from '../../lib/store'
import type { Attendance, Meeting, Tone } from '../../lib/types'
import { wishesFor } from '../../lib/wishes'

/** The one-line attendance status shown on the dashboard. */
function attendanceStatus(meeting: Meeting | undefined, mark: Attendance | undefined, now: number) {
  if (!meeting) return { text: 'No meetings scheduled yet.', label: 'No meeting', tone: 'idle' }
  const phase = phaseOf(meeting, now)
  if (mark) return { text: `${meeting.title} · marked present at ${fmtTime(mark.at)}`, label: 'Marked', tone: 'ok' }
  if (phase === 'open') return { text: `${meeting.title} is open. Mark your attendance now.`, label: 'Not marked', tone: 'bad' }
  if (phase === 'upcoming') {
    return { text: `${meeting.title} on ${fmtDate(meeting.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })}, ${fmtTime(meeting.startsAt)}`, label: 'Upcoming', tone: 'idle' }
  }
  return { text: `You did not mark attendance for ${meeting.title}.`, label: 'Not marked', tone: 'bad' }
}

export default function Home() {
  const { member, chapter, region } = useAuth()
  const db = useDB()
  const dueListOn = Boolean(chapter && db.chapters.find((c) => c.id === chapter.id)?.dueListEnabled)
  const now = useNow(30_000)
  /* how many members have dues to pay, shown on the Chapter Dues row; null until the server answers */
  const [dueCount, setDueCount] = useState<number | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  /* the Control Panel folds open and shut; this browser remembers how it was left */
  const [cpOpen, setCpOpen] = useState(() => {
    try {
      return localStorage.getItem('mc.controlPanel') !== 'closed'
    } catch {
      return true
    }
  })
  const toggleCp = () => {
    const next = !cpOpen
    setCpOpen(next)
    try {
      localStorage.setItem('mc.controlPanel', next ? 'open' : 'closed')
    } catch {
      /* private mode: the panel still works, it just forgets */
    }
  }

  useEffect(() => {
    if (!dueListOn) return
    let live = true
    void fetchDueList().then((res) => {
      if (live && res) setDueCount(res.members.length)
    })
    return () => {
      live = false
    }
  }, [dueListOn])

  if (!member) return null

  const canControl = isHeadTable(db, member)
  const canAttendance = hasAttendancePermission(db, member)
  const canVisitor = hasVisitorHostPermission(db, member)
  const canShowControls = canControl || canVisitor
  const mates = db.members.filter((m) => m.chapterId === member.chapterId)
  const meeting = currentMeeting(db.meetings.filter((m) => m.chapterId === member.chapterId), now)
  const att = attendanceStatus(meeting, meeting ? db.attendance.find((a) => a.meetingId === meeting.id && a.memberId === member.id) : undefined, now)
  const todays = wishesFor(mates, now).filter((w) => w.daysAway === 0)
  const nBirthdays = todays.filter((w) => w.kind === 'birthday').length
  const nAnniversaries = todays.length - nBirthdays
  const wishText = todays.length
    ? [nBirthdays && `${nBirthdays} ${nBirthdays === 1 ? 'birthday' : 'birthdays'}`, nAnniversaries && `${nAnniversaries} ${nAnniversaries === 1 ? 'anniversary' : 'anniversaries'}`].filter(Boolean).join(' and ') + ' today'
    : 'No birthdays or anniversaries today.'
  const pending = db.invoices.filter((i) => i.memberId === member.id && i.status === 'due')
  const waiting = db.polls.filter((p) => p.chapterId === member.chapterId && !p.closed && !db.votes.some((v) => v.pollId === p.id && v.memberId === member.id))
  const hour = new Date(now).getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateline = new Date(now).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page">
      <section className={`hero${canShowControls ? ' hero--console' : ''}`}>
        <div className="hero__id">
          <span className="hero__avatar">
            <Avatar name={member.name} photo={member.photo} size={64} />
            <i className="hero__dot" aria-hidden />
          </span>
          <div className="hero__text">
            <div className="hero__date">{dateline}</div>
            <h1>
              {greeting}, <span>{firstName(member.name)}</span>
            </h1>
            <p>Welcome back to your chapter.</p>
            <div className="chips hero__chips">
              <span className="chip chip--gold">{member.designation}</span>
              {chapter && <span className="chip">{chapter.name}</span>}
              {region && <span className="chip">{region.name}</span>}
            </div>
            {canAttendance && (
              <button type="button" className="hero__qr" onClick={() => setQrOpen(true)} title="Show Attendance QR code" aria-label="Show Attendance QR code">
                <span className="hero__qr-ico">
                  <QrCodeIcon size={20} />
                </span>
                <span className="hero__qr-txt">
                  <b>Attendance QR</b>
                  <small>Show the live code</small>
                </span>
                <ChevronRight size={16} className="hero__qr-go" />
              </button>
            )}
          </div>
        </div>

        {canShowControls && (
          <nav className={`cp${cpOpen ? ' is-open' : ''}`} aria-label="Control Panel">
            <button type="button" className="cp__head" onClick={toggleCp} aria-expanded={cpOpen} aria-controls="cp-keys">
              <span className="cp__title">
                <Settings size={15} aria-hidden className="cp__gear" /> Control Panel
              </span>
              <span className="cp__count">{(canControl ? 7 : 0) + (canVisitor ? 1 : 0)} shortcuts</span>
              <span className="cp__led" aria-hidden />
              <ChevronDown size={18} className="cp__chev" aria-hidden />
            </button>
            <div className="cp__body" id="cp-keys" inert={!cpOpen}>
              <div className="cp__inner">
            <div className="cp__grid">
              {/* order: Accounts, Team, Meetings, Polls, Payments, Visitor, Reports, Settings */}
              {canControl && (
                <>
                  <ControlCard i={1} to="/accounts" icon={Landmark} tone="steel" title="Accounts" sub="Masters" />
                  <ControlCard i={2} to="/team" icon={Users} tone="green" title="Team" sub="Chapter" />
                  <ControlCard i={3} to="/meetings" icon={CalendarClock} tone="gold" title="Meetings" sub="Schedules" />
                  <ControlCard i={4} to="/manage-rsvp" icon={ListChecks} tone="green" title="Polls" sub="Responses" />
                  <ControlCard i={5} to="/payments" icon={HandCoins} tone="navy" title="Payments" sub="Collect" />
                </>
              )}
              {canVisitor && <ControlCard i={6} to="/visitor" icon={UserCheck} tone="red" title="Visitor" sub="Host QR" />}
              {canControl && (
                <>
                  <ControlCard i={7} to="/reports" icon={FileChartColumn} tone="gold" title="Reports" sub="Analytics" />
                  <ControlCard i={8} to="/settings" icon={Settings} tone="steel" title="Settings" sub="Chapter" />
                </>
              )}
            </div>
              </div>
            </div>
          </nav>
        )}
      </section>

      <nav className="menus" aria-label="Chapter menus">
        <Link to="/directory" className="menu">
          <span className="menu__ic">
            <Glyph icon={BookUser} tone="green" size={48} />
          </span>
          <span className="menu__txt">
            <b>E-Directory</b>
            <small>
              {mates.length} {mates.length === 1 ? 'member' : 'members'} of {chapter?.name}
            </small>
          </span>
          <ChevronRight size={18} className="menu__go" />
        </Link>
        {dueListOn && (
          <Link to="/due-list" className={`menu menu--hot${dueCount ? ' is-due' : ''}`}>
            <span className="menu__ic">
              <Glyph icon={ClipboardList} tone="gold" size={48} />
            </span>
            <span className="menu__txt">
              {dueCount ? <i className="menu__flag">Needs attention</i> : null}
              <b>Chapter Dues</b>
              <small>{dueCount === null ? 'Checking…' : dueCount ? `${dueCount} ${dueCount === 1 ? 'member' : 'members'} pending` : 'All clear'}</small>
            </span>
            <span className="menu__badge" aria-hidden>
              {dueCount ?? '–'}
            </span>
          </Link>
        )}
        <Link to="/office-bearers" className="menu">
          <span className="menu__ic">
            <Glyph icon={Award} tone="wine" size={48} />
          </span>
          <span className="menu__txt">
            <b>Office Bearers</b>
            <small>President, Vice President, Secretary / Treasurer and more</small>
          </span>
          <ChevronRight size={18} className="menu__go" />
        </Link>
      </nav>

      <section className="tiles" aria-label="Your status">
        <Link to="/attendance" className="tile tile--wide" style={{ '--tc': '23, 178, 106' } as CSSProperties}>
          <Glyph icon={CalendarCheck} tone="green" size={44} />
          <span className="tile__body">
            <small className="tile__label">Attendance</small>
            <b className="tile__text">{att.text}</b>
            <span className={`stat stat--${att.tone}`}>{att.label}</span>
          </span>
          <ChevronRight size={18} className="tile__go" />
        </Link>
        <Link to="/dues" className="tile" style={{ '--tc': '247, 144, 9' } as CSSProperties}>
          <Glyph icon={IndianRupee} tone="gold" size={44} />
          <span className="tile__body">
            <small className="tile__label">Dues</small>
            <b className="tile__value">{pending.length ? inr(totalOf(pending)) : '₹0'}</b>
            <span className={`stat ${pending.length ? 'stat--bad' : 'stat--ok'}`}>{pending.length ? `${pending.length} pending` : 'All paid'}</span>
          </span>
        </Link>
        <Link to="/rsvp" className="tile" style={{ '--tc': '99, 102, 241' } as CSSProperties}>
          <Glyph icon={ListChecks} tone="navy" size={44} />
          <span className="tile__body">
            <small className="tile__label">Polls</small>
            <b className="tile__value">{waiting.length}</b>
            <span className={`stat ${waiting.length ? 'stat--bad' : 'stat--ok'}`}>{waiting.length ? `${waiting.length} to answer` : 'All answered'}</span>
          </span>
        </Link>
        <Link to="/wishes" className="tile" style={{ '--tc': '139, 92, 246' } as CSSProperties}>
          <Glyph icon={PartyPopper} tone="wine" size={44} />
          <span className="tile__body">
            <small className="tile__label">Wishes today</small>
            <b className="tile__value">{todays.length}</b>
            <span className="stat stat--idle">{wishText}</span>
          </span>
        </Link>
      </section>

      {qrOpen && <AttendanceQrDialog chapterId={member.chapterId} onClose={() => setQrOpen(false)} />}
    </div>
  )
}

/** One key on the Control Panel console. */
function ControlCard({ i, to, icon: Icon, tone, title, sub }: { i: number; to: string; icon: ComponentType<LucideProps>; tone: Tone; title: string; sub: string }) {
  return (
    <Link to={to} className={`cp__tile t-${tone}`} style={{ '--i': i } as CSSProperties}>
      <span className="cp__ico">
        <Icon size={20} />
      </span>
      <b>{title}</b>
      <small>{sub}</small>
    </Link>
  )
}

/** The attendance QR code on a coordinator's screen. Only an offline meeting that has not ended gets one. */
function AttendanceQrDialog({ chapterId, onClose }: { chapterId: string; onClose: () => void }) {
  const db = useDB()
  const now = useNow(15_000)

  /* members scan on their own phones, so keep reading while the code is on screen to keep the count live */
  useEffect(() => {
    void syncWithBackend()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncWithBackend()
    }, 10_000)
    return () => window.clearInterval(timer)
  }, [])

  const meeting = currentMeeting(
    db.meetings.filter((m) => m.chapterId === chapterId && m.mode === 'offline' && phaseOf(m, now) !== 'ended'),
    now,
  )
  const opensAt = meeting ? windowOf(meeting).opensAt : 0

  return (
    <div className="scan" role="dialog" aria-modal="true" aria-label="Attendance QR Code" onClick={onClose}>
      <div className="scan__card" style={{ maxWidth: 480, padding: '24px 20px' }} onClick={(e) => e.stopPropagation()}>
        <div className="scan__head" style={{ marginBottom: 12 }}>
          <h2>
            <QrCodeIcon size={20} /> Attendance QR Code
          </h2>
          <button type="button" className="scan__x" onClick={onClose} aria-label="Close QR display">
            <X size={18} />
          </button>
        </div>
        {meeting && phaseOf(meeting, now) === 'open' ? (
          <CoordinatorQr
            meeting={meeting}
            marked={db.attendance.filter((a) => a.meetingId === meeting.id).length}
            total={db.members.filter((m) => m.chapterId === chapterId && m.loginEnabled !== false).length}
            compact
            showMeeting
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            {meeting ? (
              <>
                <MeetingBrief meeting={meeting} />
                <p style={{ color: 'var(--ink-mute)', fontSize: 14, marginTop: 10 }}>
                  The QR code opens at {fmtTime(new Date(opensAt).toISOString())}, {OPENS_BEFORE_MIN} minutes before the meeting.
                </p>
              </>
            ) : (
              <p style={{ color: 'var(--ink-mute)', fontSize: 14 }}>No upcoming offline meeting for your chapter. The QR code appears when one is created.</p>
            )}
            <Link to="/meetings" className="btn btn--primary" style={{ marginTop: 14 }} onClick={onClose}>
              Go to Meetings
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
