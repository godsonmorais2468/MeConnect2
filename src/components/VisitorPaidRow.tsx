import { Download, Trash2 } from 'lucide-react'
import { Avatar } from './ui'
import { fmtDate, inr } from '../lib/format'
import { downloadVisitorReceipt } from '../lib/invoicePdf'
import type { Chapter, Region, VisitorPayment } from '../lib/types'

/** The fee a visitor paid when registering, in the same shape as a member's payment: already paid, with its receipt. */
export default function VisitorPaidRow({ payment: v, chapter, region, onDelete }: { payment: VisitorPayment; chapter: Chapter; region: Region | null; onDelete?: () => void }) {
  return (
    <li className="prow">
      <input type="checkbox" className="prow__check" checked disabled aria-label={`${v.visitorName}'s visitor fee is paid`} />
      <Avatar name={v.visitorName} size={44} />
      <div className="prow__main">
        <b>{v.visitorName}</b>
        <span>
          Visitor fee · {chapter.name} · {v.visitorPhone}
        </span>
        <span className="prow__meta">
          {v.receipt} · Paid {fmtDate(v.paidAt)}
          {v.referredByName ? ` · Referred by ${v.referredByName}` : ''}
        </span>
      </div>
      <div className="prow__side">
        <b>{inr(v.amount)}</b>
        <span className="chip">{v.mode}</span>
        <span className="stat stat--ok">Paid</span>
        <button type="button" className="iconbtn" aria-label={`Download receipt ${v.receipt}`} title="Download receipt" onClick={() => downloadVisitorReceipt({ payment: v, chapter, region })}>
          <Download size={15} />
        </button>
        {onDelete && (
          <button type="button" className="iconbtn" aria-label={`Delete ${v.visitorName}'s visitor fee`} title="Delete payment" onClick={onDelete}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </li>
  )
}
