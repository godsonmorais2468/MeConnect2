import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, ChevronRight, FileText } from 'lucide-react'
import { Glyph, PageHead } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { inr } from '../../lib/format'
import { useDB } from '../../lib/store'

export default function Vouchers() {
  const { member, chapter } = useAuth()
  const db = useDB()
  if (!member || !chapter) return null

  const mine = (db.vouchers || []).filter((v) => v.chapterId === chapter.id)
  const sum = (kind: 'payment' | 'receipt') => {
    const list = mine.filter((v) => v.kind === kind)
    return `${list.length} ${list.length === 1 ? 'voucher' : 'vouchers'} · ${inr(list.reduce((n, v) => n + v.amount, 0))}`
  }

  const tiles = [
    { to: 'payment', icon: ArrowUpRight, tone: 'red' as const, title: 'Payment Vouchers (Expense)', text: 'Record money the chapter paid out. A voucher number is given from the financial year settings.', stat: sum('payment') },
    { to: 'receipt', icon: ArrowDownLeft, tone: 'green' as const, title: 'Receipt Vouchers (Income)', text: 'Record money the chapter received. Receipt numbers continue the same sequence as member receipts.', stat: sum('receipt') },
  ]

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={FileText}
        tone="gold"
        title="Vouchers"
        subtitle="Record the chapter's expenses and income. Numbers and the financial year come from the financial year settings."
        actions={
          <Link className="btn btn--line btn--sm" to="/accounts">
            <ArrowLeft size={16} /> Accounts
          </Link>
        }
      />

      <div className="ptiles">
        {tiles.map((t) => (
          <Link key={t.to} to={`/accounts/vouchers/${t.to}`} className="ptile">
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
