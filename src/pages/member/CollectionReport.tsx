import { useState } from 'react'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import { Download, FileChartColumn, SlidersHorizontal } from 'lucide-react'
import CpHero, { Nums } from '../../components/CpHero'
import PaidRow from '../../components/PaidRow'
import { Field } from '../../components/ui'
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

  const kindMax = Math.max(1, ...byKind.map((x) => x.total))
  const modeMax = Math.max(1, ...byMode.map((x) => x.total))

  return (
    <div className="page cr">
      <CpHero className="cr-hero" icon={FileChartColumn} eyebrow={`${chapter.name} · ${member.designation}`} title="Collection Report" sub="Everything members have paid, from the app and from the payments you recorded." back={{ to: '/reports', label: 'Reports' }}>
        <div className="cx-side">
          <div className="cr-total">
            <small>Collected</small>
            <b>{inr(collected)}</b>
            <span>
              {rows.length} {rows.length === 1 ? 'payment' : 'payments'}
            </span>
          </div>
          <Nums
            items={[
              [verificationPendingCount, 'to verify'],
              [inr(pending), 'still pending'],
            ]}
          />
        </div>
      </CpHero>

      <button className="cr-toggle" onClick={() => setShowFilters((o) => !o)} aria-expanded={showFilters}>
        <SlidersHorizontal size={16} /> Filters
        {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
      </button>

      <div className={`cr-filters rfilters ${showFilters ? 'is-open' : ''}`}>
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

      {rows.length > 0 && (
        <section className="cr-split" aria-label="Collection breakdown">
          <div className="cr-panel">
            <h3>By request type</h3>
            <ul>
              {byKind.map((x) => (
                <li key={x.k}>
                  <div>
                    <span>{x.k}</span>
                    <small>{x.n}</small>
                    <b>{inr(x.total)}</b>
                  </div>
                  <i style={{ width: `${Math.max(4, Math.round((x.total / kindMax) * 100))}%` }} />
                </li>
              ))}
            </ul>
          </div>
          <div className="cr-panel cr-panel--mode">
            <h3>By mode of payment</h3>
            <ul>
              {byMode.map((x) => (
                <li key={x.m}>
                  <div>
                    <span>{x.m}</span>
                    <b>{inr(x.total)}</b>
                  </div>
                  <i style={{ width: `${Math.max(4, Math.round((x.total / modeMax) * 100))}%` }} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="cr-listbar">
        <h2>
          Collections <span>{rows.length}</span>
        </h2>
        <button type="button" className="cp-act" onClick={downloadPdf} disabled={rows.length === 0}>
          <Download size={15} /> Download PDF
        </button>
      </div>
      <ListSearch value={q} onChange={setQ} placeholder="Search payments" />
      {q && listRows.length === 0 && rows.length > 0 && <NoMatch query={q} />}
      {rows.length === 0 ? (
        <div className="cp-empty">
          <FileChartColumn size={30} />
          <b>Nothing collected for these filters</b>
          <span>Payments show up here as soon as members pay their dues.</span>
        </div>
      ) : (
        <ul className="plist cr-list">
          {listRows.map((r) => (
            <PaidRow key={r.invoice.id} row={r} chapter={chapterName(r.member.chapterId)} />
          ))}
        </ul>
      )}
    </div>
  )
}
