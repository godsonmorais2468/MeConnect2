import { Link } from 'react-router-dom'
import { BookOpen, CalendarCheck, ChevronRight, FileChartColumn, IndianRupee, PieChart, Smartphone } from 'lucide-react'
import CpHero from '../../components/CpHero'
import { useAuth } from '../../lib/auth'
import { totalOf } from '../../lib/dues'
import { inr } from '../../lib/format'
import { paidInChapter } from '../../lib/payments'
import { useDB } from '../../lib/store'

/** Reports: the headline numbers first, then the reports as a short list under two headings. */
export default function Reports() {
  const { member, chapter } = useAuth()
  const db = useDB()
  if (!member || !chapter) return null

  const chapterPaid = paidInChapter(db, chapter.id)
  const totalCollected = totalOf(chapterPaid.map((p) => p.invoice))
  const chapterPending = db.invoices.filter((i) => i.status === 'due' && db.members.some((m) => m.id === i.memberId && m.chapterId === chapter.id))
  const totalOutstanding = totalOf(chapterPending)

  const chapterMeetings = db.meetings.filter((m) => m.chapterId === chapter.id)
  const chapterAttendance = db.attendance.filter((a) => chapterMeetings.some((m) => m.id === a.meetingId))

  const chapterMemberCount = db.members.filter((m) => m.chapterId === chapter.id && m.isActive !== false && m.loginEnabled !== false).length

  /* how much of what was billed has come in */
  const billed = totalCollected + totalOutstanding
  const share = billed > 0 ? Math.round((totalCollected / billed) * 100) : 0

  const kpis = [
    { label: 'Collected', value: inr(totalCollected), note: `${chapterPaid.length} receipts`, cls: 'ok' },
    { label: 'Outstanding', value: inr(totalOutstanding), note: `${chapterPending.length} unpaid`, cls: 'bad' },
    { label: 'Attendance', value: String(chapterAttendance.length), note: `${chapterMeetings.length} meetings`, cls: 'acc' },
    { label: 'Members', value: String(chapterMemberCount), note: 'signed in', cls: 'acc' },
  ]

  const groups = [
    {
      title: 'Money',
      items: [
        { to: '/payments/collection', icon: FileChartColumn, title: 'Collection Report', text: 'Collections by invoice type, payment mode and date range.', stat: `${inr(totalCollected)} collected` },
        { to: '/reports/dues', icon: IndianRupee, title: 'Dues & Outstanding Report', text: 'Pending dues, upcoming invoices and outstanding balances.', stat: `${inr(totalOutstanding)} pending` },
        { to: '/reports/ledger', icon: BookOpen, title: 'Transaction Books / Ledger', text: 'Ledger by income or expense category, member and mode.', stat: `${chapterPaid.length} ${chapterPaid.length === 1 ? 'entry' : 'entries'}` },
      ],
    },
    {
      title: 'People and meetings',
      items: [
        { to: '/reports/attendance', icon: CalendarCheck, title: 'Attendance Report', text: 'Marked attendance, substitutes and registered visitors.', stat: `${chapterAttendance.length} attendances` },
        { to: '/reports/app-usage', icon: Smartphone, title: 'App Usage Report', text: 'Who has signed up, finished a profile and uses the app.', stat: `${chapterMemberCount} members` },
      ],
    },
  ]

  return (
    <div className="page rp">
      <CpHero className="rp-hero" icon={PieChart} eyebrow={`${chapter.name} · ${member.designation}`} title="Reports" sub="Collections, member dues and meeting attendance for your chapter.">
        <span className="rp-ring" role="img" aria-label={`${share} percent of billed amount collected`}>
          <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden>
            <circle cx="46" cy="46" r="40" fill="none" strokeWidth="7" className="rp-ring__bg" />
            <circle cx="46" cy="46" r="40" fill="none" strokeWidth="7" strokeLinecap="round" className="rp-ring__fg" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 * (1 - share / 100)} transform="rotate(-90 46 46)" />
          </svg>
          <span>
            <b>{share}%</b>
            <small>collected</small>
          </span>
        </span>
      </CpHero>

      <div className="rp-kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`rp-kpi rp-kpi--${k.cls}`}>
            <small>{k.label}</small>
            <b>{k.value}</b>
            <span>{k.note}</span>
          </div>
        ))}
      </div>

      {groups.map((g) => (
        <section key={g.title} className="rp-group" aria-label={g.title}>
          <h2>{g.title}</h2>
          <ul>
            {g.items.map((r) => (
              <li key={r.to}>
                <Link to={r.to} className="rp-row">
                  <span className="rp-row__ico">
                    <r.icon size={20} />
                  </span>
                  <span className="rp-row__txt">
                    <b>{r.title}</b>
                    <small>{r.text}</small>
                  </span>
                  <em>{r.stat}</em>
                  <ChevronRight size={18} className="rp-row__go" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
