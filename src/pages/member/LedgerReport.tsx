import { useState } from 'react'
import { BookOpen, Download, SlidersHorizontal, TrendingDown, TrendingUp } from 'lucide-react'
import CpHero from '../../components/CpHero'
import { Field } from '../../components/ui'
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

  const clearFilters = () => {
    setEntryType('all')
    setSelectedCategory('')
    setSelectedMember('')
    setSelectedMode('')
    setSelectedBank('')
    setFromDate('')
    setToDate('')
  }

  return (
    <div className="page lg">
      <CpHero className="lg-hero" icon={BookOpen} eyebrow={`${chapter.name} · ${member.designation}`} title="Transaction Books / Ledger Reports" sub="The chapter's general ledger, by income and expense head, member, payment mode and bank account." back={{ to: '/reports', label: 'Reports' }}>
        <div className="dr-total">
          <small>Net ledger balance</small>
          <b className={netBalance < 0 ? 'is-neg' : ''}>{inr(netBalance)}</b>
          <span>
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </CpHero>

      <div className="lg-totals">
        <div className="lg-totals__cr">
          <TrendingUp size={18} />
          <span>
            <small>Total credits (inflow)</small>
            <b>{inr(totalCredit)}</b>
          </span>
        </div>
        <div className="lg-totals__dr">
          <TrendingDown size={18} />
          <span>
            <small>Total debits (outflow)</small>
            <b>{inr(totalDebit)}</b>
          </span>
        </div>
      </div>

      <button type="button" className="cr-toggle" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
        <SlidersHorizontal size={16} /> Filters
        {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
      </button>

      <div className={`cr-filters cr-filters--wide rfilters ${showFilters ? 'is-open' : ''}`}>
        <Field label="Entry nature">
          <select className="field__control native-select" value={entryType} onChange={(e) => setEntryType(e.target.value as EntryType)}>
            <option value="all">All entries</option>
            <option value="income">Income Only</option>
            <option value="expense">Expenses Only</option>
          </select>
        </Field>
        <Field label="Category">
          <select className="field__control native-select" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="">All categories</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Member">
          <select className="field__control native-select" value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)}>
            <option value="">All Members</option>
            {chapterMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.organisation ? `(${m.organisation})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payment mode">
          <select className="field__control native-select" value={selectedMode} onChange={(e) => setSelectedMode(e.target.value)}>
            <option value="">All modes</option>
            {availableModes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bank / ledger account">
          <select className="field__control native-select" value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}>
            <option value="">All accounts</option>
            {availableBanks.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From date">
          <input className="field__control" type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
        </Field>
        <Field label="To date">
          <input className="field__control" type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
        </Field>
        {activeFilters > 0 && (
          <button type="button" className="cp-act cr-clear" onClick={clearFilters}>
            Clear all
          </button>
        )}
      </div>

      <div className="cr-listbar">
        <h2>
          Ledger entries <span>{filtered.length}</span>
        </h2>
        <button type="button" className="cp-act" onClick={downloadPdf} disabled={filtered.length === 0}>
          <Download size={15} /> Download PDF
        </button>
      </div>
      <ListSearch value={q} onChange={setQ} placeholder="Search by particulars, member, category, mode, or reference no..." />
      {q && searched.length === 0 && filtered.length > 0 && <NoMatch query={q} />}

      {filtered.length === 0 ? (
        <div className="cp-empty">
          <BookOpen size={30} />
          <b>No ledger transactions found</b>
          <span>Transactions appear here once invoices, expenses, or payments are recorded in your chapter.</span>
        </div>
      ) : (
        <div className="lg-book">
          <div className="lg-head" aria-hidden>
            <span>Date</span>
            <span>Particulars</span>
            <span>Debit</span>
            <span>Credit</span>
          </div>
          <ul>
            {searched.map((e) => (
              <li key={e.id} className={`lg-row lg-row--${e.entryType === 'income' ? 'cr' : 'dr'}`}>
                <time className="lg-date" dateTime={e.date}>
                  <b>{e.date ? fmtDate(e.date, { day: 'numeric' }) : '–'}</b>
                  <small>{e.date ? fmtDate(e.date, { month: 'short', year: 'numeric' }) : ''}</small>
                </time>
                <div className="lg-part">
                  <div className="lg-part__top">
                    <b>{e.category}</b>
                    <em>{e.entryType === 'income' ? 'Income' : 'Expense'}</em>
                  </div>
                  <p>{e.remark}</p>
                  <small>
                    {e.paymentMode}
                    {e.bankName ? ` (${e.bankName})` : ''}
                    {e.member ? ` · ${e.member.name}` : ''}
                  </small>
                  <small>
                    {e.voucherOrInvoiceNo}
                    {e.referenceNo && e.referenceNo !== '-' && e.referenceNo !== e.voucherOrInvoiceNo ? ` (${e.referenceNo})` : ''} · Paid {e.paidDate ? fmtDate(e.paidDate) : e.date ? fmtDate(e.date) : '-'} · Verified {e.verifiedDate ? fmtDate(e.verifiedDate) : '—'}
                  </small>
                </div>
                <div className="lg-amt lg-amt--dr" aria-label="Debit">
                  {e.debit ? inr(e.debit) : ''}
                </div>
                <div className="lg-amt lg-amt--cr" aria-label="Credit">
                  {e.credit ? inr(e.credit) : ''}
                </div>
              </li>
            ))}
          </ul>
          <div className="lg-foot">
            <span>Total{searched.length !== filtered.length ? ' (all filtered)' : ''}</span>
            <b className="lg-amt--dr">{inr(totalDebit)}</b>
            <b className="lg-amt--cr">{inr(totalCredit)}</b>
          </div>
        </div>
      )}
    </div>
  )
}
