import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, FileText } from 'lucide-react'
import CpHero, { Nums } from '../../components/CpHero'
import { useAuth } from '../../lib/auth'
import { inr } from '../../lib/format'
import { useDB } from '../../lib/store'

/** Vouchers: two books, side by side. Money out on one side, money in on the other. */
export default function Vouchers() {
  const { member, chapter } = useAuth()
  const db = useDB()
  if (!member || !chapter) return null

  const mine = (db.vouchers || []).filter((v) => v.chapterId === chapter.id)
  const sum = (kind: 'payment' | 'receipt') => {
    const list = mine.filter((v) => v.kind === kind)
    return { count: list.length, total: list.reduce((n, v) => n + v.amount, 0) }
  }
  const out = sum('payment')
  const inn = sum('receipt')

  const panels = [
    { to: 'receipt', cls: 'in', icon: ArrowDownLeft, kicker: 'Income', title: 'Receipt Vouchers', text: 'Record money the chapter received. Receipt numbers continue the same sequence as member receipts.', ...inn },
    { to: 'payment', cls: 'out', icon: ArrowUpRight, kicker: 'Expense', title: 'Payment Vouchers', text: 'Record money the chapter paid out. A voucher number is given from the financial year settings.', ...out },
  ]

  return (
    <div className="page vh">
      <CpHero className="vh-hero" icon={FileText} eyebrow={`${chapter.name} · ${member.designation}`} title="Vouchers" sub="Record the chapter's expenses and income. Numbers and the financial year come from the financial year settings." back={{ to: '/accounts', label: 'Accounts' }}>
        <Nums
          items={[
            [mine.length, 'vouchers'],
            [inr(inn.total - out.total), 'net'],
          ]}
        />
      </CpHero>

      <div className="vh-split">
        {panels.map((p) => (
          <Link key={p.to} to={`/accounts/vouchers/${p.to}`} className={`vh-panel vh-panel--${p.cls}`}>
            <p.icon className="vh-panel__mark" size={190} strokeWidth={1} aria-hidden />
            <span className="vh-panel__kicker">
              <p.icon size={15} /> {p.kicker}
            </span>
            <h2>{p.title}</h2>
            <p>{p.text}</p>
            <div className="vh-panel__sum">
              <strong>{inr(p.total)}</strong>
              <span>
                {p.count} {p.count === 1 ? 'voucher' : 'vouchers'}
              </span>
            </div>
            <span className="vh-panel__cta">
              Open the book <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
