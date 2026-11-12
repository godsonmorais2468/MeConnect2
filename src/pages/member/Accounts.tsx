import { headsOf } from '../../lib/heads'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight, CreditCard, FileText, Landmark, Layers } from 'lucide-react'
import { Glyph, PageHead } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { useDB } from '../../lib/store'

export default function Accounts() {
  const { member, chapter } = useAuth()
  const db = useDB()
  if (!member || !chapter) return null

  const modes = (db.paymentModes || []).filter((m) => m.chapterId === chapter.id)
  const years = (db.financialYears || []).filter((y) => y.chapterId === chapter.id)
  const currentYear = years.find((y) => y.isCurrent)
  const banks = (db.bankAccounts || []).filter((b) => b.chapterId === chapter.id)
  const heads = headsOf(db, chapter.id)
  const vouchers = (db.vouchers || []).filter((v) => v.chapterId === chapter.id)

  const tiles = [
    {
      to: 'financial-year',
      icon: CalendarClock,
      tone: 'gold' as const,
      title: 'Financial Year Settings',
      text: 'Define fiscal year spans, set active period, lock past financial books.',
      stat: currentYear ? `Current: ${currentYear.title}` : `${years.length} ${years.length === 1 ? 'year' : 'years'} configured`,
    },
    {
      to: 'banks',
      icon: Landmark,
      tone: 'green' as const,
      title: 'Bank Master',
      text: 'Chapter bank accounts, account numbers, IFSC codes, branches and UPI IDs.',
      stat: `${banks.length} ${banks.length === 1 ? 'account' : 'accounts'} registered`,
    },
    {
      to: 'modes',
      icon: CreditCard,
      tone: 'navy' as const,
      title: 'Mode of Pay',
      text: 'Manage allowed payment modes: UPI, Cheque, Cash, Net Banking, POS.',
      stat: `${modes.length} ${modes.length === 1 ? 'mode' : 'modes'} configured`,
    },
    {
      to: 'heads',
      icon: Layers,
      tone: 'steel' as const,
      title: 'Income & Expense Heads',
      text: 'Define master categories for chapter incomes, dues, expenses and audits.',
      stat: `${heads.length} ${heads.length === 1 ? 'head' : 'heads'} configured`,
    },
    {
      to: 'vouchers',
      icon: FileText,
      tone: 'gold' as const,
      title: 'Vouchers',
      text: 'Payment vouchers for expenses and receipt vouchers for income, numbered from the financial year settings.',
      stat: `${vouchers.length} ${vouchers.length === 1 ? 'voucher' : 'vouchers'} recorded`,
    },
  ]

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={Landmark}
        tone="navy"
        title="Accounts"
        subtitle="Configure modes of payment, financial year settings, bank accounts, income & expense heads and vouchers for your chapter."
      />

      <div className="ptiles">
        {tiles.map((t) => (
          <Link key={t.to} to={`/accounts/${t.to}`} className="ptile">
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
