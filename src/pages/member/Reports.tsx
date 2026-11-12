import { Link } from 'react-router-dom'
import { BookOpen, CalendarCheck, ChevronRight, FileChartColumn, IndianRupee, PieChart, Smartphone } from 'lucide-react'
import { Glyph, PageHead } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { totalOf } from '../../lib/dues'
import { inr } from '../../lib/format'
import { paidInChapter } from '../../lib/payments'
import { useDB } from '../../lib/store'

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

  const tiles = [
    {
      to: '/payments/collection',
      icon: FileChartColumn,
      tone: 'gold' as const,
      title: 'Collection Report',
      text: 'Detailed payment collections breakdown by invoice type, payment mode, and date range.',
      stat: `${inr(totalCollected)} collected · ${chapterPaid.length} receipts`,
    },
    {
      to: '/reports/dues',
      icon: IndianRupee,
      tone: 'red' as const,
      title: 'Dues & Outstanding Report',
      text: 'Summary of pending dues, upcoming invoices, and outstanding balances across chapter members.',
      stat: `${inr(totalOutstanding)} pending · ${chapterPending.length} unpaid`,
    },
    {
      to: '/reports/ledger',
      icon: BookOpen,
      tone: 'steel' as const,
      title: 'Transaction Books / Ledger Reports',
      text: 'Fetch ledger data by income/expense category, member, and payment mode with debit/credit entries.',
      stat: `${chapterPaid.length} ledger ${chapterPaid.length === 1 ? 'entry' : 'entries'}`,
    },
    {
      to: '/reports/attendance',
      icon: CalendarCheck,
      tone: 'green' as const,
      title: 'Attendance Report',
      text: 'View marked attendance, enter and track substitutes, and manage registered meeting visitors.',
      stat: `${chapterAttendance.length} attendances · ${chapterMeetings.length} meetings`,
    },
    {
      to: '/reports/app-usage',
      icon: Smartphone,
      tone: 'navy' as const,
      title: 'App Usage Report',
      text: 'See which members have signed up, completed their profile and use attendance, polls and dues.',
      stat: `${chapterMemberCount} members`,
    },
  ]

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={PieChart}
        tone="navy"
        title="Reports"
        subtitle="Access financial collections, member dues, and meeting attendance analytics for your chapter."
      />

      <div className="ptiles">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="ptile">
            <Glyph icon={t.icon} tone={t.tone} size={62} />
            <span className="ptile__body">
              <b>{t.title}</b>
              <span>{t.text}</span>
              <em>{t.stat}</em>
            </span>
            <ChevronRight size={20} className="ptile__go" />
          </Link>
        ))}
      </div>
    </div>
  )
}
