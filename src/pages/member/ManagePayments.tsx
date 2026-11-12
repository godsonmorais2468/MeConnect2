import { Link } from 'react-router-dom'
import { ArrowRight, Banknote, HandCoins, PencilLine, SendHorizontal } from 'lucide-react'
import CpHero from '../../components/CpHero'
import { useAuth } from '../../lib/auth'
import { paidInChapter } from '../../lib/payments'
import { useDB } from '../../lib/store'

/** Payments: the three jobs in the order they happen. Ask, check, then record what came in by hand. */
export default function ManagePayments() {
  const { member, chapter } = useAuth()
  const db = useDB()
  if (!member || !chapter) return null

  const requests = db.requests.filter((r) => r.chapterId === chapter.id)
  const paid = paidInChapter(db, chapter.id)
  const pending = db.invoices.filter((i) => i.status === 'due' && db.members.some((m) => m.id === i.memberId && m.chapterId === chapter.id))

  const steps = [
    { to: 'request', icon: SendHorizontal, cls: 'ask', title: 'Payment Request', text: 'Ask chapter members to pay: dues, event fees, donations.', stat: `${requests.length} ${requests.length === 1 ? 'request' : 'requests'} sent`, cta: 'Send a request' },
    { to: 'update', icon: Banknote, cls: 'check', title: 'Payment Verifications', text: 'See who has paid and how, and verify member payments.', stat: `${pending.length} pending · ${paid.length} paid`, cta: 'Check payments' },
    { to: 'manual-update', icon: PencilLine, cls: 'note', title: 'Payment Manual Update', text: 'Record a cheque, cash or UPI payment you received.', stat: 'Record a payment', cta: 'Record one' },
  ]

  return (
    <div className="page py">
      <CpHero className="py-hero" icon={HandCoins} eyebrow={`${chapter.name} · ${member.designation}`} title="Manage Payments" sub="Send payment requests, keep track of what is paid and see what has been collected.">
        <div className="py-hero__kpi">
          <span>
            <b>{pending.length}</b>
            <small>pending</small>
          </span>
          <span>
            <b>{paid.length}</b>
            <small>paid</small>
          </span>
        </div>
      </CpHero>

      <ol className="py-flow">
        {steps.map((s, i) => (
          <li key={s.to}>
            <Link to={`/payments/${s.to}`} className={`py-step py-step--${s.cls}`}>
              <span className="py-step__n" aria-hidden>
                {i + 1}
              </span>
              <span className="py-step__ico">
                <s.icon size={26} />
              </span>
              <b>{s.title}</b>
              <span className="py-step__text">{s.text}</span>
              <em>{s.stat}</em>
              <span className="py-step__cta">
                {s.cta} <ArrowRight size={16} />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
