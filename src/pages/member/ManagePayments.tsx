import { Link } from 'react-router-dom'
import { Banknote, ChevronRight, HandCoins, PencilLine, SendHorizontal } from 'lucide-react'
import { Glyph, PageHead } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { paidInChapter } from '../../lib/payments'
import { useDB } from '../../lib/store'

export default function ManagePayments() {
  const { member, chapter } = useAuth()
  const db = useDB()
  if (!member || !chapter) return null

  const requests = db.requests.filter((r) => r.chapterId === chapter.id)
  const paid = paidInChapter(db, chapter.id)
  const pending = db.invoices.filter((i) => i.status === 'due' && db.members.some((m) => m.id === i.memberId && m.chapterId === chapter.id))

  const tiles = [
    { to: 'request', icon: SendHorizontal, tone: 'red' as const, title: 'Payment Request', text: 'Ask chapter members to pay: dues, event fees, donations.', stat: `${requests.length} ${requests.length === 1 ? 'request' : 'requests'} sent` },
    { to: 'update', icon: Banknote, tone: 'green' as const, title: 'Payment Verifications', text: 'See who has paid and how, and verify member payments.', stat: `${pending.length} pending · ${paid.length} paid` },
    { to: 'manual-update', icon: PencilLine, tone: 'gold' as const, title: 'Payment Manual Update', text: 'Record a cheque, cash or UPI payment you received.', stat: 'Record a payment' },
  ]

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={HandCoins}
        tone="navy"
        title="Manage Payments"
        subtitle="Send payment requests to your chapter members, keep track of what is paid, and see what has been collected."
      />

      <div className="ptiles">
        {tiles.map((t) => (
          <Link key={t.to} to={`/payments/${t.to}`} className="ptile">
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
