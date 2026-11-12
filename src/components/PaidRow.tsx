import { Trash2 } from 'lucide-react'
import { Avatar } from './ui'
import { fmtDate, inr } from '../lib/format'
import { invoiceNo } from '../lib/invoicePdf'
import { kindOf, modeDetails, modeLabel } from '../lib/payments'
import type { PaidRow as Row } from '../lib/payments'

/** One received payment: who paid, what for, how much, by which mode, and the mode's own details. */
export default function PaidRow({ row, chapter, check, onDelete }: { row: Row; chapter: string; check?: { checked: boolean; onChange: () => void }; onDelete?: () => void }) {
  const { invoice: i, member: m } = row
  const details = modeDetails(i)
  const waiting = i.status === 'pending'
  return (
    <li className="prow">
      {check && (
        <input
          type="checkbox"
          className="prow__check"
          checked={check.checked || !waiting}
          disabled={!waiting}
          onChange={check.onChange}
          aria-label={waiting ? `Select payment of ${m.name}` : `${m.name}'s payment is verified`}
        />
      )}
      <Avatar name={m.name} photo={m.photo} size={44} />
      <div className="prow__main">
        <b>{m.name}</b>
        <span>
          {kindOf(i)} · {chapter}
        </span>
        <span className="prow__meta">
          {invoiceNo(i)}{row.together && row.together.length > 1 ? ` + ${row.together.length - 1} more` : ''} · Paid {fmtDate(i.paidAt ?? '')} · {i.ref}
        </span>
        {row.together && row.together.length > 1 && (
          <span className="prow__meta">
            {row.together.length} dues paid together: {fmtDate(row.together[0].dueDate)} to {fmtDate(row.together[row.together.length - 1].dueDate)}
          </span>
        )}
        {details.length > 0 && (
          <span className="prow__det">
            {details.map((d) => (
              <span key={d.label}>
                {d.label}: <b>{d.value}</b>
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="prow__side">
        <b>{inr(i.amount)}</b>
        <span className={`chip ${i.method === 'Cheque' ? 'chip--gold' : i.method === 'UPI' ? 'chip--red' : ''}`}>{modeLabel(i)}</span>
        {check && <span className={`stat ${waiting ? 'stat--idle' : 'stat--ok'}`}>{waiting ? 'Pending' : 'Paid'}</span>}
        {onDelete && (
          <button type="button" className="iconbtn" aria-label={`Delete ${m.name}'s payment`} title="Delete payment" onClick={onDelete}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </li>
  )
}
