import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Clock, Download, IndianRupee, SlidersHorizontal, TriangleAlert, UserCheck } from 'lucide-react'
import { Avatar, Field, PageHead, Sheet, StatStrip } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { byDueDate, isOverdue, totalOf } from '../../lib/dues'
import { fmtDate, inr } from '../../lib/format'
import { useNow } from '../../lib/hooks'
import { invoiceNo } from '../../lib/invoicePdf'
import { kindOf } from '../../lib/payments'
import { downloadReportPdf } from '../../lib/reportPdf'
import { useDB } from '../../lib/store'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import type { Member } from '../../lib/types'

type DuesFilter = 'all' | 'overdue' | 'upcoming' | 'pending'

export default function DuesReport() {
  const { member, chapter } = useAuth()
  const db = useDB()
  const now = useNow(60_000)

  const [q, setQ] = useState('')
  const [filterType, setFilterType] = useState<DuesFilter>('all')
  const [selectedKind, setSelectedKind] = useState('')
  const [selectedMember, setSelectedMember] = useState('')
  const [showFilters, setShowFilters] = useState(() => window.matchMedia('(min-width: 721px)').matches)

  if (!member || !chapter) return null

  // Chapter members
  const chapterMembers = db.members.filter((m) => m.chapterId === chapter.id && m.loginEnabled !== false)
  const memberMap = new Map<string, Member>(chapterMembers.map((m) => [m.id, m]))

  // Unpaid invoices in this chapter: 'due' or 'pending' (verification pending)
  const chapterInvoices = db.invoices.filter((i) => {
    const m = memberMap.get(i.memberId)
    return !!m && (i.status === 'due' || i.status === 'pending')
  })

  // Distinct kinds for filtering
  const kinds = Array.from(new Set(chapterInvoices.map((i) => kindOf(i)).filter(Boolean)))

  // Classify invoices
  const overdueInvoices = chapterInvoices.filter((i) => i.status === 'due' && isOverdue(i, now))
  const upcomingInvoices = chapterInvoices.filter((i) => i.status === 'due' && !isOverdue(i, now))
  const pendingVerificationInvoices = chapterInvoices.filter((i) => i.status === 'pending')

  // Total sums
  const totalOutstanding = totalOf(chapterInvoices.filter((i) => i.status === 'due'))
  const totalOverdue = totalOf(overdueInvoices)
  const totalUpcoming = totalOf(upcomingInvoices)
  const totalPendingVerification = totalOf(pendingVerificationInvoices)

  // Filtered rows
  const filteredInvoices = chapterInvoices
    .filter((inv) => {
      if (filterType === 'overdue' && !isOverdue(inv, now)) return false
      if (filterType === 'upcoming' && (isOverdue(inv, now) || inv.status === 'pending')) return false
      if (filterType === 'pending' && inv.status !== 'pending') return false

      if (selectedKind && kindOf(inv) !== selectedKind) return false
      if (selectedMember && inv.memberId !== selectedMember) return false

      return true
    })
    .sort(byDueDate)

  const searchedInvoices = filteredInvoices.filter((inv) => {
    const mem = memberMap.get(inv.memberId)
    return matches(q, mem?.name, mem?.organisation, inv.label, inv.no, kindOf(inv), inv.amount, inv.dueDate)
  })

  function downloadPdf() {
    if (!chapter) return

    downloadReportPdf({
      title: 'Dues & Outstanding Report',
      subtitle: 'Outstanding balances, unpaid invoices, and overdue tracking by member',
      chapterName: chapter.name,
      summaryStats: [
        { label: 'Total Outstanding', value: inr(totalOutstanding) },
        { label: 'Overdue Dues', value: inr(totalOverdue) },
        { label: 'Upcoming Invoices', value: inr(totalUpcoming) },
        { label: 'Pending Verification', value: inr(totalPendingVerification) },
      ],
      amountInWords: {
        label: 'Total Outstanding',
        amount: totalOutstanding,
      },
      columns: [
        { title: 'Member', width: 140 },
        { title: 'Invoice / Kind', width: 140 },
        { title: 'Due Date', width: 85 },
        { title: 'Status', width: 85 },
        { title: 'Amount', width: 85 },
      ],
      rows: filteredInvoices.map((inv) => {
        const mem = memberMap.get(inv.memberId)
        const overdue = isOverdue(inv, now)
        const statusText = inv.status === 'pending' ? 'Verification Pending' : overdue ? 'Overdue' : 'Due'
        return [
          `${mem?.name || 'Unknown'}${mem?.organisation ? ` (${mem.organisation})` : ''}`,
          `${invoiceNo(inv)} - ${kindOf(inv)}`,
          inv.dueDate ? fmtDate(inv.dueDate) : 'No due date',
          statusText,
          inr(inv.amount),
        ]
      }),
      filename: `dues-outstanding-report-${chapter.name.toLowerCase().replace(/\s+/g, '-')}`,
    })
  }

  const activeFilters = [filterType !== 'all' ? filterType : '', selectedKind, selectedMember].filter(Boolean).length

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={IndianRupee}
        tone="red"
        title="Dues & Outstanding Report"
        subtitle="Chapter-wide report of pending member dues, upcoming invoices, and outstanding balances."
        actions={
          <Link className="btn btn--line btn--sm" to="/reports">
            <ArrowLeft size={16} /> Reports
          </Link>
        }
      />

      <StatStrip
        items={[
          { label: 'Total Outstanding', value: inr(totalOutstanding), icon: IndianRupee, tone: 'red' },
          { label: 'Overdue Dues', value: inr(totalOverdue), icon: TriangleAlert, tone: 'red' },
          { label: 'Upcoming Invoices', value: inr(totalUpcoming), icon: Clock, tone: 'gold' },
          { label: 'Pending Verification', value: inr(totalPendingVerification), icon: UserCheck, tone: 'navy' },
        ]}
      />

      <div className="att">
        <button
          type="button"
          className="btn btn--line filters-toggle"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal size={16} /> Filters
          {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
        </button>

        <div className={`rfilters ${showFilters ? 'is-open' : ''}`}>
          <Sheet
            icon={SlidersHorizontal}
            tone="red"
            title="Filters"
            note={
              activeFilters > 0 ? (
                <button
                  type="button"
                  className="btn btn--line btn--sm"
                  onClick={() => {
                    setFilterType('all')
                    setSelectedKind('')
                    setSelectedMember('')
                  }}
                >
                  Clear all
                </button>
              ) : undefined
            }
          >
            <div className="form-grid">
              <Field label="Status">
                <select
                  className="field__control native-select"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as DuesFilter)}
                >
                  <option value="all">All Outstanding ({chapterInvoices.length})</option>
                  <option value="overdue">Overdue ({overdueInvoices.length})</option>
                  <option value="upcoming">Upcoming Invoices ({upcomingInvoices.length})</option>
                  <option value="pending">Verification Pending ({pendingVerificationInvoices.length})</option>
                </select>
              </Field>

              <Field label="Request / Kind">
                <select
                  className="field__control native-select"
                  value={selectedKind}
                  onChange={(e) => setSelectedKind(e.target.value)}
                >
                  <option value="">All invoice types</option>
                  {kinds.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Member">
                <select
                  className="field__control native-select"
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                >
                  <option value="">All members</option>
                  {chapterMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.organisation ? `(${m.organisation})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Sheet>
        </div>

        <div className="list">
          <h2 className="list__title">
            Outstanding Invoices <span>{filteredInvoices.length}</span>
            <button
              type="button"
              className="btn btn--line btn--sm list__act"
              onClick={downloadPdf}
              disabled={filteredInvoices.length === 0}
            >
              <Download size={15} /> Download PDF
            </button>
          </h2>

          <ListSearch value={q} onChange={setQ} placeholder="Search members, invoice no, kind or amount" />

          {q && searchedInvoices.length === 0 && filteredInvoices.length > 0 && <NoMatch query={q} />}

          {filteredInvoices.length === 0 ? (
            <div className="empty">
              <b>No outstanding dues found.</b>
              All member dues and invoices for this selection have been paid and verified.
            </div>
          ) : (
            <ul className="plist">
              {searchedInvoices.map((inv) => {
                const mem = memberMap.get(inv.memberId)
                const overdue = isOverdue(inv, now)
                const waitingVerification = inv.status === 'pending'

                return (
                  <li key={inv.id} className="prow">
                    <Avatar name={mem?.name ?? 'Member'} photo={mem?.photo} size={44} />
                    <div className="prow__main">
                      <b>{mem?.name ?? 'Unknown Member'}</b>
                      <span>
                        {kindOf(inv)} {mem?.organisation ? `· ${mem.organisation}` : ''}
                      </span>
                      <span className="prow__meta">
                        {invoiceNo(inv)} · Due: {inv.dueDate ? fmtDate(inv.dueDate) : 'No due date'}
                      </span>
                    </div>
                    <div className="prow__side">
                      <b>{inr(inv.amount)}</b>
                      {waitingVerification ? (
                        <span className="stat stat--idle">Verification Pending</span>
                      ) : overdue ? (
                        <span className="stat stat--bad">Overdue</span>
                      ) : (
                        <span className="stat stat--gold">Upcoming</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
