import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Download, HandCoins, SlidersHorizontal, TrendingDown, TrendingUp } from 'lucide-react'
import { Avatar, Field, PageHead, Sheet, StatStrip } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { inr, fmtDate } from '../../lib/format'
import { invoiceNo } from '../../lib/invoicePdf'
import { kindOf, modeLabel } from '../../lib/payments'
import { downloadReportPdf } from '../../lib/reportPdf'
import { useDB } from '../../lib/store'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import type { Member } from '../../lib/types'

type EntryType = 'all' | 'income' | 'expense'

interface LedgerEntry {
  id: string
  entryType: 'income' | 'expense'
  category: string
  categoryComment?: string
  date: string
  paidDate?: string
  verifiedDate?: string
  referenceNo: string
  voucherOrInvoiceNo: string
  member?: Member
  remark: string
  paymentMode: string
  bankName: string
  debit: number
  credit: number
  amount: number
}

export default function LedgerReport() {
  const { member, chapter } = useAuth()
  const db = useDB()

  const [q, setQ] = useState('')
  const [entryType, setEntryType] = useState<EntryType>('all')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedMember, setSelectedMember] = useState('')
  const [selectedMode, setSelectedMode] = useState('')
  const [selectedBank, setSelectedBank] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showFilters, setShowFilters] = useState(() => window.matchMedia('(min-width: 721px)').matches)

  if (!member || !chapter) return null

  // Chapter members
  const chapterMembers = db.members.filter((m) => m.chapterId === chapter.id)
  const memberMap = new Map<string, Member>(chapterMembers.map((m) => [m.id, m]))

  // Chapter Account Heads
  const chapterHeads = (db.accountHeads || []).filter((h) => h.chapterId === chapter.id)
  const headMap = new Map<string, { type: 'income' | 'expense'; comment: string }>(
    chapterHeads.map((h) => [h.name.toLowerCase().trim(), { type: h.headType, comment: h.comment }])
  )

  // Chapter Modes of Pay from Accounts
  const chapterPaymentModes = (db.paymentModes || []).filter((m) => m.chapterId === chapter.id)
  const modeLedgerMap = new Map<string, string>(
    chapterPaymentModes.map((m) => [m.name.toLowerCase().trim(), m.code || 'Cash'])
  )

  // Chapter Bank Accounts from Accounts > Bank Master
  const chapterBanks = (db.bankAccounts || []).filter((b) => b.chapterId === chapter.id)
  const defaultBank = chapterBanks.find((b) => b.isDefault) || chapterBanks[0]

  // Build ledger entries from chapter records (paid receipts and transaction records)
  // For each settled invoice in chapter:
  const entries: LedgerEntry[] = []

  for (const inv of db.invoices) {
    const mem = memberMap.get(inv.memberId)
    if (!mem || inv.status !== 'paid') continue

    const catName = kindOf(inv)
    const headInfo = headMap.get(catName.toLowerCase().trim())
    const eType: 'income' | 'expense' = headInfo ? headInfo.type : 'income'
    const mode = modeLabel(inv) || inv.method || 'Cash'
    const date = (inv.paidAt || inv.dueDate || '').slice(0, 10)

    // Resolve Bank Name from linked mode ledger or chapter bank accounts
    let bankName = modeLedgerMap.get(mode.toLowerCase().trim()) || ''
    if (!bankName || bankName === 'Cash') {
      if (mode.toLowerCase() === 'cash') {
        bankName = 'Cash'
      } else {
        bankName = defaultBank ? defaultBank.bankName : 'Cash'
      }
    }

    const paidDate = (inv.paidAt || '').slice(0, 10)
    const verifiedDate = (inv.verifiedAt || '').slice(0, 10)
    const remark = inv.description || (mem ? `Paid by ${mem.name}${mem.organisation ? ` (${mem.organisation})` : ''}` : '-')

    entries.push({
      id: inv.id,
      entryType: eType,
      category: catName,
      categoryComment: headInfo?.comment,
      date,
      paidDate,
      verifiedDate,
      referenceNo: inv.ref || '-',
      voucherOrInvoiceNo: invoiceNo(inv),
      member: mem,
      remark,
      paymentMode: mode,
      bankName,
      credit: eType === 'income' ? inv.amount : 0,
      debit: eType === 'expense' ? inv.amount : 0,
      amount: inv.amount,
    })
  }

  // Include chapter vouchers (payment vouchers = expenses, receipt vouchers = income)
  for (const v of db.vouchers || []) {
    if (v.chapterId !== chapter.id) continue

    const eType: 'income' | 'expense' = v.kind === 'payment' ? 'expense' : 'income'
    const mode = v.modeName || 'Cash'
    const date = (v.date || '').slice(0, 10)
    const headInfo = headMap.get((v.headName || '').toLowerCase().trim())
    const remark = v.remarks || headInfo?.comment || `${v.headName} (${eType === 'expense' ? 'Payment Voucher' : 'Receipt Voucher'})`

    let bankName = modeLedgerMap.get(mode.toLowerCase().trim()) || ''
    if (!bankName || bankName === 'Cash') {
      if (mode.toLowerCase() === 'cash') {
        bankName = 'Cash'
      } else {
        bankName = defaultBank ? defaultBank.bankName : 'Cash'
      }
    }

    entries.push({
      id: v.id,
      entryType: eType,
      category: v.headName || (eType === 'expense' ? 'Expense' : 'Income'),
      categoryComment: headInfo?.comment,
      date,
      paidDate: date,
      verifiedDate: (v.createdAt || '').slice(0, 10) || date,
      referenceNo: v.number,
      voucherOrInvoiceNo: v.number,
      remark,
      paymentMode: mode,
      bankName,
      credit: eType === 'income' ? v.amount : 0,
      debit: eType === 'expense' ? v.amount : 0,
      amount: v.amount,
    })
  }

  // Extract distinct categories, modes, and banks for dropdowns
  const availableCategories = Array.from(
    new Set([
      ...chapterHeads.map((h) => h.name),
      ...entries.map((e) => e.category),
    ])
  ).filter(Boolean)

  // Payment Modes fetched directly from Accounts > Mode of Pay
  const availableModes = chapterPaymentModes.length > 0
    ? chapterPaymentModes.map((m) => m.name)
    : ['Cash', 'UPI', 'Cheque']

  // Bank names from Bank Master and entries
  const availableBanks = Array.from(
    new Set([
      'Cash',
      ...chapterBanks.map((b) => b.bankName),
      ...entries.map((e) => e.bankName),
    ])
  ).filter(Boolean)

  // Filtering
  const filtered = entries.filter((e) => {
    if (entryType !== 'all' && e.entryType !== entryType) return false
    if (selectedCategory && e.category.toLowerCase() !== selectedCategory.toLowerCase()) return false
    if (selectedMember && e.member?.id !== selectedMember) return false
    if (selectedMode && e.paymentMode.toLowerCase() !== selectedMode.toLowerCase()) return false
    if (selectedBank && e.bankName.toLowerCase() !== selectedBank.toLowerCase()) return false
    if (fromDate && e.date < fromDate) return false
    if (toDate && e.date > toDate) return false
    return true
  }).sort((a, b) => b.date.localeCompare(a.date))

  const searched = filtered.filter((e) =>
    matches(
      q,
      e.category,
      e.remark,
      e.member?.name,
      e.member?.organisation,
      e.paymentMode,
      e.bankName,
      e.referenceNo,
      e.voucherOrInvoiceNo,
      e.amount
    )
  )

  // Calculations
  const totalCredit = filtered.reduce((acc, e) => acc + e.credit, 0)
  const totalDebit = filtered.reduce((acc, e) => acc + e.debit, 0)
  const netBalance = totalCredit - totalDebit

  function downloadPdf() {
    if (!chapter) return

    downloadReportPdf({
      title: 'Transaction Books / Ledger Report',
      subtitle: 'Complete general ledger statements by account heads, members, and payment modes',
      chapterName: chapter.name,
      summaryStats: [
        { label: 'Total Credits (Inflow)', value: inr(totalCredit) },
        { label: 'Total Debits (Outflow)', value: inr(totalDebit) },
        { label: 'Net Balance', value: inr(netBalance) },
      ],
      amountInWords: {
        label: 'Net Balance',
        amount: netBalance,
      },
      columns: [
        { title: 'Inc / Exp Head', width: 95 },
        { title: 'Remark / Particulars', width: 125 },
        { title: 'Mode of Pay (Bank)', width: 85 },
        { title: 'Doc No. & Dates', width: 95 },
        { title: 'Debit', width: 55 },
        { title: 'Credit', width: 55 },
      ],
      rows: filtered.map((e) => [
        e.category,
        `${e.remark}${e.member ? ` [${e.member.name}]` : ''}`,
        `${e.paymentMode}${e.bankName ? ` (${e.bankName})` : ''}`,
        `${e.voucherOrInvoiceNo}\nPaid: ${e.paidDate ? fmtDate(e.paidDate) : (e.date ? fmtDate(e.date) : '-')}${e.verifiedDate ? `\nVer: ${fmtDate(e.verifiedDate)}` : ''}`,
        e.debit ? inr(e.debit) : '-',
        e.credit ? inr(e.credit) : '-',
      ]),
      filename: `ledger-report-${chapter.name.toLowerCase().replace(/\s+/g, '-')}`,
    })
  }

  const activeFilters = [
    entryType !== 'all' ? entryType : '',
    selectedCategory,
    selectedMember,
    selectedMode,
    selectedBank,
    fromDate,
    toDate,
  ].filter(Boolean).length

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={BookOpen}
        tone="gold"
        title="Transaction Books / Ledger Reports"
        subtitle="Comprehensive chapter general ledger statements, categorized by income & expense heads, members, payment modes, and bank accounts."
        actions={
          <Link className="btn btn--line btn--sm" to="/reports">
            <ArrowLeft size={16} /> Reports
          </Link>
        }
      />

      <StatStrip
        items={[
          { label: 'Total Credits (Inflow)', value: inr(totalCredit), icon: TrendingUp, tone: 'green' },
          { label: 'Total Debits (Outflow)', value: inr(totalDebit), icon: TrendingDown, tone: 'red' },
          {
            label: 'Net Ledger Balance',
            value: inr(netBalance),
            icon: HandCoins,
            tone: netBalance >= 0 ? 'gold' : 'red',
          },
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
            tone="gold"
            title="Filter Ledger Entries"
            note={
              activeFilters > 0 ? (
                <button
                  type="button"
                  className="btn btn--line btn--sm"
                  onClick={() => {
                    setEntryType('all')
                    setSelectedCategory('')
                    setSelectedMember('')
                    setSelectedMode('')
                    setSelectedBank('')
                    setFromDate('')
                    setToDate('')
                  }}
                >
                  Clear all
                </button>
              ) : undefined
            }
          >
            <div className="form-grid">
              <Field label="Entry Nature">
                <select
                  className="field__control native-select"
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as EntryType)}
                >
                  <option value="all">All entries</option>
                  <option value="income">Income Only</option>
                  <option value="expense">Expenses Only</option>
                </select>
              </Field>

              <Field label="Category">
                <select
                  className="field__control native-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">All categories</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
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
                  <option value="">All Members</option>
                  {chapterMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.organisation ? `(${m.organisation})` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Payment Mode">
                <select
                  className="field__control native-select"
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                >
                  <option value="">All modes</option>
                  {availableModes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Bank / Ledger Account">
                <select
                  className="field__control native-select"
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                >
                  <option value="">All accounts</option>
                  {availableBanks.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="From Date">
                <input
                  className="field__control"
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </Field>

              <Field label="To Date">
                <input
                  className="field__control"
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </Field>
            </div>
          </Sheet>
        </div>

        <div className="list">
          <h2 className="list__title">
            Ledger Entries <span>{filtered.length}</span>
            <button
              type="button"
              className="btn btn--line btn--sm list__act"
              onClick={downloadPdf}
              disabled={filtered.length === 0}
            >
              <Download size={15} /> Download PDF
            </button>
          </h2>

          <ListSearch
            value={q}
            onChange={setQ}
            placeholder="Search by particulars, member, category, mode, or reference no..."
          />

          {q && searched.length === 0 && filtered.length > 0 && <NoMatch query={q} />}

          {filtered.length === 0 ? (
            <div className="empty">
              <b>No ledger transactions found.</b>
              Transactions appear here once invoices, expenses, or payments are recorded in your chapter.
            </div>
          ) : (
            <ul className="plist">
              {searched.map((e) => (
                <li key={e.id} className="prow">
                  {e.member ? (
                    <Avatar name={e.member.name} photo={e.member.photo} size={44} />
                  ) : (
                    <div className="glyph t-steel" style={{ '--size': '44px' } as any}>
                      <BookOpen size={20} />
                    </div>
                  )}

                  <div className="prow__main">
                    {/* 1. Inc/Exp Head 1st and Bold */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                      <b style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{e.category}</b>
                      <span className={`headkind ${e.entryType === 'income' ? 'headkind--income' : 'headkind--expense'}`}>
                        {e.entryType === 'income' ? 'Income Head' : 'Expense Head'}
                      </span>
                    </div>

                    {/* 2. >> Remark */}
                    <p style={{ margin: '0 0 4px', fontSize: 13.5, color: 'var(--ink-light, #2B3B4B)', fontWeight: 500, lineHeight: 1.4 }}>
                      <span style={{ color: 'var(--ink-mute)', fontWeight: 600 }}>Remark: </span>
                      {e.remark}
                    </p>

                    {/* 3. >> Mode of Pay */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-mute)', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Mode of Pay:</span>
                      <b>{e.paymentMode}</b>
                      {e.bankName && (
                        <span>({e.bankName})</span>
                      )}
                      {e.member && (
                        <span>· Member: <b style={{ color: 'var(--ink)' }}>{e.member.name}</b></span>
                      )}
                    </div>

                    {/* 4. >> Inc/Rec + Paid & Verified date */}
                    <span className="prow__meta" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>
                        <b>Doc / Ref:</b> {e.voucherOrInvoiceNo}{e.referenceNo && e.referenceNo !== '-' && e.referenceNo !== e.voucherOrInvoiceNo ? ` (${e.referenceNo})` : ''}
                      </span>
                      <span>·</span>
                      <span>
                        <b>Paid Date:</b> {e.paidDate ? fmtDate(e.paidDate) : (e.date ? fmtDate(e.date) : '-')}
                      </span>
                      <span>·</span>
                      <span>
                        <b>Verified Date:</b> {e.verifiedDate ? fmtDate(e.verifiedDate) : 'Verified'}
                      </span>
                    </span>
                  </div>

                  <div className="prow__side">
                    <b style={{ color: e.entryType === 'income' ? 'var(--green-ink, #08734F)' : 'var(--danger)', fontSize: 16 }}>
                      {e.entryType === 'income' ? `+${inr(e.credit)}` : `-${inr(e.debit)}`}
                    </b>
                    <span className={`chip ${e.entryType === 'income' ? 'chip--green' : 'chip--red'}`}>
                      {e.entryType === 'income' ? 'Credit / Inflow' : 'Debit / Outflow'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
