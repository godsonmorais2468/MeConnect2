import { headsOf } from '../../lib/heads'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarClock, CreditCard, FileText, Landmark, Layers } from 'lucide-react'
import CpHero from '../../components/CpHero'
import { useAuth } from '../../lib/auth'
import { useDB } from '../../lib/store'

/** Accounts: a bento of the five books. The financial year is the big one, the rest show how many they hold. */
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

  const cards = [
    { to: 'financial-year', icon: CalendarClock, cls: 'fy', title: 'Financial Year Settings', text: 'Define fiscal year spans, set active period, lock past financial books.', big: currentYear ? currentYear.title : String(years.length), unit: currentYear ? 'Current year' : years.length === 1 ? 'year configured' : 'years configured' },
    { to: 'banks', icon: Landmark, cls: 'bank', title: 'Bank Master', text: 'Bank accounts, account numbers, IFSC codes, branches and UPI IDs.', big: String(banks.length), unit: banks.length === 1 ? 'account' : 'accounts' },
    { to: 'modes', icon: CreditCard, cls: 'mode', title: 'Mode of Pay', text: 'Allowed payment modes: UPI, Cheque, Cash, Net Banking, POS.', big: String(modes.length), unit: modes.length === 1 ? 'mode' : 'modes' },
    { to: 'heads', icon: Layers, cls: 'head', title: 'Income & Expense Heads', text: 'Master categories for incomes, dues, expenses and audits.', big: String(heads.length), unit: heads.length === 1 ? 'head' : 'heads' },
    { to: 'vouchers', icon: FileText, cls: 'vou', title: 'Vouchers', text: 'Payment vouchers for expenses and receipt vouchers for income.', big: String(vouchers.length), unit: vouchers.length === 1 ? 'voucher' : 'vouchers' },
  ]

  return (
    <div className="page ac">
      <CpHero className="ac-hero" icon={Landmark} eyebrow={`${chapter.name} · ${member.designation}`} title="Accounts" sub="Modes of payment, financial year, bank accounts, income and expense heads and vouchers for your chapter.">
        <div className="ac-hero__fy">
          <small>Financial year</small>
          <b>{currentYear?.title ?? 'Not set'}</b>
        </div>
      </CpHero>

      <div className="ac-bento">
        {cards.map((c) => (
          <Link key={c.to} to={`/accounts/${c.to}`} className={`ac-card ac-card--${c.cls}`}>
            <c.icon className="ac-card__mark" size={150} strokeWidth={1.1} aria-hidden />
            <span className="ac-card__ico">
              <c.icon size={22} />
            </span>
            <span className="ac-card__go" aria-hidden>
              <ArrowUpRight size={18} />
            </span>
            <span className="ac-card__body">
              <b>{c.title}</b>
              <span>{c.text}</span>
            </span>
            <span className="ac-card__stat">
              <strong>{c.big}</strong>
              <em>{c.unit}</em>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
