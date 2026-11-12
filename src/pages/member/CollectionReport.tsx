import { useState } from 'react'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import { Link } from 'react-router-dom'
import { ArrowLeft, Banknote, Clock, Download, FileChartColumn, Hourglass, Receipt, SlidersHorizontal } from 'lucide-react'
import PaidRow from '../../components/PaidRow'
import { Field, PageHead, Sheet, StatStrip } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { financialYearLabel, safeName } from '../../lib/fileNames'
import { headsOf } from '../../lib/heads'
import { totalOf } from '../../lib/dues'
import { fmtDate, inr } from '../../lib/format'
import { PAY_METHODS, kindOf, modeLabel, paidInChapter } from '../../lib/payments'
import { invoiceNo } from '../../lib/invoicePdf'
import { downloadReportPdf } from '../../lib/reportPdf'
import { useDB } from '../../lib/store'
import type { PayMethod } from '../../lib/types'

export default function CollectionReport() {
  const { member, chapter } = useAuth()
  const db = useDB()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [mode, setMode] = useState<PayMethod | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  /* On phones the filters start folded so the list is the first thing you see. */
  const [showFilters, setShowFilters] = useState(() => window.matchMedia('(min-width: 721px)').matches)

  if (!member || !chapter) return null
  const chapterName = (id: string) => (id === chapter.id ? chapter.name : '')
  const all = paidInChapter(db, chapter.id)
  const kinds = [...new Set([...headsOf(db, chapter.id).filter((h) => h.headType === 'income').map((h) => h.name), ...all.map((r) => kindOf(r.invoice))])]

  const rows = all.filter(({ invoice: i }) => {
    const day = (i.paidAt ?? '').slice(0, 10)
    return (!kind || kindOf(i) === kind) && (!mode || i.method === mode) && (!from || day >= from) && (!to || day <= to)
  })

  const listRows = rows.filter(({ invoice: i, member: m }) => matches(q, m.name, m.organisation, i.no, i.ref, i.txnId, i.chequeNo, kindOf(i), i.method, i.amount))
  const activeFilters = [kind, mode, from, to].filter(Boolean).length
  const collected = totalOf(rows.map((r) => r.invoice))
  const pending = totalOf(
    db.invoices.filter((i) => {
      const m = db.members.find((x) => x.id === i.memberId)
      return i.status === 'due' && m?.chapterId === chapter.id && (!kind || kindOf(i) === kind)
    }),
  )
  const verificationPendingCount = db.invoices.filter((i) => {
    const m = db.members.find((x) => x.id === i.memberId)
    return i.status === 'pending' && m?.chapterId === chapter.id && (!kind || kindOf(i) === kind)
  }).length

  const byKind = kinds
    .map((k) => ({ k, rows: rows.filter((r) => kindOf(r.invoice) === k) }))
    .filter((x) => x.rows.length > 0)
    .map((x) => ({ k: x.k, n: x.rows.length, total: totalOf(x.rows.map((r) => r.invoice)) }))
  const byMode = PAY_METHODS.map((m) => ({ m, total: totalOf(rows.filter((r) => r.invoice.method === m).map((r) => r.invoice)) })).filter((x) => x.total > 0)

  function downloadPdf() {
    downloadReportPdf({
      title: 'Collection Report',
      subtitle: 'Complete record of collected payments, receipts, and settlement details',
      chapterName: chapter?.name || 'ME-CONNECT',
      summaryStats: [
        { label: 'Total Collected', value: inr(collected) },
        { label: 'Payments Count', value: String(rows.length) },
        { label: 'Verification Pending', value: String(verificationPendingCount) },
        { label: 'Still Pending', value: inr(pending) },
      ],
      amountInWords: {
        label: 'Total Collected',
        amount: collected,
      },
      columns: [
        { title: 'Member', width: 140 },
        { title: 'Category / Purpose', width: 120 },
        { title: 'Invoice / Receipt', width: 110 },
        { title: 'Date', width: 75 },
        { title: 'Mode', width: 70 },
        { title: 'Amount', width: 80 },
      ],
      rows: rows.map(({ invoice: i, member: m }) => [
        `${m.name}${m.organisation ? ` (${m.organisation})` : ''}`,
        kindOf(i),
        `${invoiceNo(i)}${i.ref ? ` / ${i.ref}` : ''}`,
        i.paidAt ? fmtDate(i.paidAt) : '-',
        modeLabel(i) || i.method || 'Cash',
        inr(i.amount),
      ]),
      filename: `ME-CONNECT_${safeName(chapter?.name || 'Chapter')}_Collection-Report_${financialYearLabel(chapter?.id ?? '', new Date().toISOString().slice(0, 10))}`,
    })
  }

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={FileChartColumn}
        tone="gold"
        title="Collection Report"
        subtitle="Everything members have paid, from the app and from the payments you recorded."
        actions={
          <Link className="btn btn--line btn--sm" to="/reports">
            <ArrowLeft size={16} /> Reports
          </Link>
        }
      />

      <StatStrip
        items={[
          { icon: Banknote, tone: 'green', label: 'Collected', value: inr(collected) },
          { icon: Receipt, tone: 'gold', label: 'Payments', value: rows.length },
          { icon: Clock, tone: 'wine', label: 'Verification Pending', value: verificationPendingCount },
          { icon: Hourglass, tone: 'red', label: 'Still pending', value: inr(pending) },
        ]}
      />

      <div className="att">
        <button className="btn btn--line filters-toggle" onClick={() => setShowFilters((o) => !o)} aria-expanded={showFilters}>
          <SlidersHorizontal size={16} /> Filters
          {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
        </button>

        <div className={`rfilters ${showFilters ? 'is-open' : ''}`}>
          <Sheet icon={FileChartColumn} tone="gold" title="Filters">
            <div className="form-grid">
              <Field label="Request type">
                <select className="field__control native-select" value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="">All types</option>
                  {kinds.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Mode of payment">
                <select className="field__control native-select" value={mode} onChange={(e) => setMode(e.target.value as PayMethod | '')}>
                  <option value="">All modes</option>
                  {PAY_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Paid from">
                <input className="field__control" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="Paid to">
                <input className="field__control" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>

          </Sheet>
        </div>

        {rows.length > 0 && (
          <section className="breakdown" aria-label="Collection breakdown">
            <div>
              <h3>By request type</h3>
              <ul>
                {byKind.map((x) => (
                  <li key={x.k}>
                    <span>{x.k}</span>
                    <small>{x.n}</small>
                    <b>{inr(x.total)}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>By mode of payment</h3>
              <ul>
                {byMode.map((x) => (
                  <li key={x.m}>
                    <span>{x.m}</span>
                    <b>{inr(x.total)}</b>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <div className="list">
          <h2 className="list__title">
            Collections <span>{rows.length}</span>
            <button type="button" className="btn btn--line btn--sm list__act" onClick={downloadPdf} disabled={rows.length === 0}>
              <Download size={15} /> Download PDF
            </button>
          </h2>
          <ListSearch value={q} onChange={setQ} placeholder="Search payments" />
          {q && listRows.length === 0 && rows.length > 0 && <NoMatch query={q} />}
          {rows.length === 0 ? (
            <div className="empty">
              <b>Nothing collected for these filters.</b>
              Payments show up here as soon as members pay their dues.
            </div>
          ) : (
            <ul className="plist">
              {listRows.map((r) => (
                <PaidRow key={r.invoice.id} row={r} chapter={chapterName(r.member.chapterId)} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
