import { useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarClock, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import CpHero, { Fold, NewButton, Nums } from '../../components/CpHero'
import { Field } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { createFinancialYear, deleteFinancialYear, updateFinancialYear, useDB } from '../../lib/store'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import { fmtDate } from '../../lib/format'
import type { FinancialYear } from '../../lib/types'
import { showFormIfHidden } from '../../lib/scroll'

const FY_OPTIONS = [
  '2024-2025',
  '2025-2026',
  '2026-2027',
  '2027-2028',
  '2028-2029',
  '2029-2030',
  '2030-2031',
  '2031-2032',
  '2032-2033',
  '2033-2034',
  '2034-2035',
  '2035-2036',
]

function datesForFY(val: string) {
  const parts = val.split('-')
  if (parts.length === 2) {
    const startYear = parts[0].trim()
    const endYear = parts[1].trim()
    return {
      start: `${startYear}-04-01`,
      end: `${endYear}-03-31`,
    }
  }
  return { start: '', end: '' }
}

export default function FinancialYearSettings() {
  const { member, chapter } = useAuth()
  const db = useDB()
  const [q, setQ] = useState('')
  const toast = useToast()
  const confirm = useConfirm()

  const [editing, setEditing] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [billStartNumber, setBillStartNumber] = useState('1')
  const [invoicePrefix, setInvoicePrefix] = useState('INV')
  const [invoiceStartNumber, setInvoiceStartNumber] = useState('1')
  const [receiptPrefix, setReceiptPrefix] = useState('REC')
  const [receiptStartNumber, setReceiptStartNumber] = useState('1')
  const [voucherPrefix, setVoucherPrefix] = useState('VOU')
  const [voucherStartNumber, setVoucherStartNumber] = useState('1')
  const [errors, setErrors] = useState<Record<string, string>>({})
  /* the form: open when there are no years yet, and shut after that until it is asked for */
  const [composeOpt, setComposeOpt] = useState<boolean | null>(null)

  if (!member || !chapter) return null

  const list = (db.financialYears || []).filter((y) => y.chapterId === chapter.id)
  const filtered = list.filter((y) => matches(q, y.title, y.startDate, y.endDate, y.invoicePrefix, y.receiptPrefix, y.voucherPrefix))

  // Helper: check if a financial year has associated invoices/records in this chapter
  const chapterMembers = new Set(db.members.filter((m) => m.chapterId === chapter.id).map((m) => m.id))
  function isYearInUse(y: FinancialYear): { inUse: boolean; count: number; reason?: string } {
    const invoiceCount = db.invoices.filter((inv) => {
      if (!chapterMembers.has(inv.memberId)) return false
      const invDate = (inv.paidAt || inv.issuedAt || inv.dueDate || '').slice(0, 10)
      if (!invDate) return false
      return invDate >= y.startDate && invDate <= y.endDate
    }).length

    if (invoiceCount > 0) {
      return {
        inUse: true,
        count: invoiceCount,
        reason: `Locked: ${invoiceCount} invoice(s)/record(s) exist within this financial year.`,
      }
    }
    return { inUse: false, count: 0 }
  }

  // Active year is either the explicit current year or the one matching today's date
  const today = new Date().toISOString().slice(0, 10)
  const activeYear = list.find((y) => y.isCurrent) || list.find((y) => today >= y.startDate && today <= y.endDate) || list[0]

  function onSelectFY(selected: string) {
    setTitle(selected)
    if (selected) {
      const { start, end } = datesForFY(selected)
      setStartDate(start)
      setEndDate(end)
    }
    if (errors.title) setErrors({})
  }

  function reset() {
    setEditing(null)
    setTitle('')
    setStartDate('')
    setEndDate('')
    setBillStartNumber('1')
    setInvoicePrefix('INV')
    setInvoiceStartNumber('1')
    setReceiptPrefix('REC')
    setReceiptStartNumber('1')
    setVoucherPrefix('VOU')
    setVoucherStartNumber('1')
    setErrors({})
    setComposeOpt(false)
  }

  function startEdit(y: FinancialYear) {
    const lockInfo = isYearInUse(y)
    if (lockInfo.inUse) {
      toast(lockInfo.reason || 'This financial year is locked because records exist.', 'info')
      return
    }
    setComposeOpt(true)
    setEditing(y.id)
    setTitle(y.title)
    setStartDate(y.startDate)
    setEndDate(y.endDate)
    setBillStartNumber(String(y.billStartNumber || 1))
    setInvoicePrefix(y.invoicePrefix || 'INV')
    setInvoiceStartNumber(String(y.invoiceStartNumber || y.billStartNumber || 1))
    setReceiptPrefix(y.receiptPrefix || 'REC')
    setReceiptStartNumber(String(y.receiptStartNumber || 1))
    setVoucherPrefix(y.voucherPrefix || 'VOU')
    setVoucherStartNumber(String(y.voucherStartNumber || 1))
    setErrors({})
    showFormIfHidden()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!chapter) return

    const isFirstYear = list.length === 0

    const input = {
      regionId: chapter.regionId,
      chapterId: chapter.id,
      title,
      startDate,
      endDate,
      billStartNumber: parseInt(invoiceStartNumber, 10) || parseInt(billStartNumber, 10) || 1,
      invoicePrefix: invoicePrefix.trim().toUpperCase() || 'INV',
      invoiceStartNumber: parseInt(invoiceStartNumber, 10) || 1,
      receiptPrefix: receiptPrefix.trim().toUpperCase() || 'REC',
      receiptStartNumber: parseInt(receiptStartNumber, 10) || 1,
      voucherPrefix: voucherPrefix.trim().toUpperCase() || 'VOU',
      voucherStartNumber: parseInt(voucherStartNumber, 10) || 1,
      isCurrent: isFirstYear ? true : undefined,
    }

    const res = editing ? await updateFinancialYear(editing, input) : await createFinancialYear(input)

    if (res.error) {
      if (res.field) setErrors({ [res.field]: res.error })
      else toast(res.error, 'info')
      return
    }

    toast(`Financial year "${title}" ${editing ? 'updated' : 'saved'}`)
    reset()
  }

  async function remove(y: FinancialYear) {
    const lockInfo = isYearInUse(y)
    if (lockInfo.inUse) {
      toast(lockInfo.reason || 'Cannot delete: Financial year is locked because records exist.', 'info')
      return
    }

    const ok = await confirm({
      title: 'Delete Financial Year?',
      message: `Are you sure you want to delete "${y.title}"?`,
    })
    if (!ok) return

    const res = await deleteFinancialYear(y.id)
    if (res.error) {
      toast(res.error, 'info')
      return
    }
    toast(`Financial year "${y.title}" deleted`)
    if (editing === y.id) reset()
  }

  const lockedCount = list.filter((y) => isYearInUse(y).inUse).length

  const compose = composeOpt ?? list.length === 0
  const todayMs = Date.parse(today)
  /* the years run down a timeline, the latest first */
  const ordered = [...filtered].sort((a, b) => b.startDate.localeCompare(a.startDate))

  return (
    <div className="page fy">
      <CpHero className="fy-hero" icon={CalendarClock} eyebrow={`${chapter.name} · ${member.designation}`} title="Financial Year Settings" sub="Fiscal periods, the active financial year, and the number series for invoices, receipts and vouchers." back={{ to: '/accounts', label: 'Accounts' }}>
        <div className="cx-side">
          <Nums
            items={[
              [list.length, 'years'],
              [activeYear?.title || 'Not set', 'current'],
              [lockedCount, 'locked'],
            ]}
          />
          <NewButton open={compose} label="New year" controls="fy-fold" onClick={() => (compose ? reset() : setComposeOpt(true))} />
        </div>
      </CpHero>

      <Fold id="fy-fold" open={compose} label="Financial year form">
        <form className="cp-form cp-form--stack" onSubmit={submit} noValidate>
          <h2 className="cp-form__h">
            {editing ? <Pencil size={17} /> : <Plus size={17} />} {editing ? 'Edit financial year' : 'New financial year'}
          </h2>
          <div className="cp-wide">
            <Field label="Financial Year" error={errors.title} required>
              <select className="field__control" value={title} onChange={(e) => onSelectFY(e.target.value)}>
                <option value="">Select Financial Year</option>
                {FY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* three number series, side by side */}
          <div className="fy-series cp-wide">
            <fieldset className="fy-series__box fy-series__box--inv">
              <legend>Invoice</legend>
              <Field label="Prefix">
                <input type="text" className="field__control" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())} placeholder="INV" />
              </Field>
              <Field label="Start number">
                <input type="number" min="1" className="field__control" value={invoiceStartNumber} onChange={(e) => setInvoiceStartNumber(e.target.value)} placeholder="1" />
              </Field>
            </fieldset>
            <fieldset className="fy-series__box fy-series__box--rec">
              <legend>Receipt</legend>
              <Field label="Prefix">
                <input type="text" className="field__control" value={receiptPrefix} onChange={(e) => setReceiptPrefix(e.target.value.toUpperCase())} placeholder="REC" />
              </Field>
              <Field label="Start number">
                <input type="number" min="1" className="field__control" value={receiptStartNumber} onChange={(e) => setReceiptStartNumber(e.target.value)} placeholder="1" />
              </Field>
            </fieldset>
            <fieldset className="fy-series__box fy-series__box--vou">
              <legend>Voucher</legend>
              <Field label="Prefix">
                <input type="text" className="field__control" value={voucherPrefix} onChange={(e) => setVoucherPrefix(e.target.value.toUpperCase())} placeholder="VOU" />
              </Field>
              <Field label="Start number">
                <input type="number" min="1" className="field__control" value={voucherStartNumber} onChange={(e) => setVoucherStartNumber(e.target.value)} placeholder="1" />
              </Field>
            </fieldset>
          </div>

          <div className="cp-form__foot">
            {editing && (
              <button type="button" className="cp-btn cp-btn--ghost" onClick={reset}>
                Cancel
              </button>
            )}
            <button type="submit" className="cp-btn">
              {editing ? 'Save changes' : 'Add financial year'}
            </button>
          </div>
        </form>
      </Fold>

      <div className="cp-bar">
        <ListSearch value={q} onChange={setQ} placeholder="Search financial years..." />
      </div>
      {q && filtered.length === 0 && list.length > 0 && <NoMatch query={q} />}

      {list.length === 0 ? (
        <div className="cp-empty">
          <CalendarClock size={30} />
          <b>No financial years set</b>
          <span>Add your chapter's fiscal year with the button above.</span>
        </div>
      ) : (
        <ol className="fy-line">
          {ordered.map((y) => {
            const lockInfo = isYearInUse(y)
            const isCurrentActive = activeYear?.id === y.id
            const from = Date.parse(y.startDate)
            const to = Date.parse(y.endDate)
            /* how far through the year today is (only meaningful while today falls inside it) */
            const pos = to > from ? Math.min(100, Math.max(0, Math.round(((todayMs - from) / (to - from)) * 100))) : 0
            const inside = todayMs >= from && todayMs <= to
            return (
              <li key={y.id} className={`fy-item${isCurrentActive ? ' is-active' : ''}${lockInfo.inUse ? ' is-locked' : ''}${editing === y.id ? ' is-editing' : ''}`}>
                <span className="fy-item__dot" aria-hidden />
                <article className="fy-card">
                  <header>
                    <h3>{y.title}</h3>
                    {isCurrentActive && <span className="fy-tag fy-tag--on">Active year</span>}
                    {lockInfo.inUse && (
                      <span className="fy-tag fy-tag--lock" title={lockInfo.reason}>
                        <Lock size={11} /> Locked
                      </span>
                    )}
                    <div className="cp-acts">
                      {lockInfo.inUse ? (
                        <button type="button" className="cp-act cp-act--icon" disabled title={lockInfo.reason} aria-label="Locked">
                          <Lock size={14} />
                        </button>
                      ) : (
                        <>
                          <button type="button" className="cp-act cp-act--icon" title="Edit year" aria-label={`Edit ${y.title}`} onClick={() => startEdit(y)}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" className="cp-act cp-act--icon cp-act--danger" title="Delete year" aria-label={`Delete ${y.title}`} onClick={() => remove(y)}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </header>
                  <div className="fy-span" role="img" aria-label={inside ? `${pos} percent of the year has passed` : 'Not the current period'}>
                    <span>{fmtDate(y.startDate)}</span>
                    <div>
                      <i style={{ width: `${inside ? pos : todayMs > to ? 100 : 0}%` }} />
                    </div>
                    <span>{fmtDate(y.endDate)}</span>
                  </div>
                  <ul className="fy-tickets">
                    <li className="fy-ticket fy-ticket--inv">
                      <small>Invoice</small>
                      <b>
                        {y.invoicePrefix || 'INV'}-#{y.invoiceStartNumber ?? y.billStartNumber ?? 1}
                      </b>
                    </li>
                    <li className="fy-ticket fy-ticket--rec">
                      <small>Receipt</small>
                      <b>
                        {y.receiptPrefix || 'REC'}-#{y.receiptStartNumber ?? 1}
                      </b>
                    </li>
                    <li className="fy-ticket fy-ticket--vou">
                      <small>Voucher</small>
                      <b>
                        {y.voucherPrefix || 'VOU'}-#{y.voucherStartNumber ?? 1}
                      </b>
                    </li>
                  </ul>
                </article>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
