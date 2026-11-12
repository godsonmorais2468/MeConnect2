import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarClock, CheckCircle2, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { Field, Glyph, PageHead, Sheet, StatStrip } from '../../components/ui'
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
  }

  function startEdit(y: FinancialYear) {
    const lockInfo = isYearInUse(y)
    if (lockInfo.inUse) {
      toast(lockInfo.reason || 'This financial year is locked because records exist.', 'info')
      return
    }
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

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={CalendarClock}
        tone="gold"
        title="Financial Year Settings"
        subtitle="Manage fiscal periods, select the active financial year, and configure invoice billing start numbers."
        actions={
          <Link className="btn btn--line btn--sm" to="/accounts">
            <ArrowLeft size={16} /> Accounts
          </Link>
        }
      />

      <StatStrip
        items={[
          { icon: CalendarClock, tone: 'gold', label: 'Fiscal Years', value: list.length },
          { icon: CheckCircle2, tone: 'green', label: 'Current Year', value: activeYear?.title || 'Not Set' },
          { icon: Lock, tone: 'wine', label: 'Locked Years', value: lockedCount },
        ]}
      />

      <div className="duo">
        <Sheet
          icon={editing ? Pencil : Plus}
          tone="gold"
          title={editing ? 'Edit financial year' : 'New financial year'}
          note={chapter.name}
        >
          <form className="form-stack" onSubmit={submit} noValidate>
            <Field label="Financial Year" error={errors.title} required>
              <select
                className="field__control"
                value={title}
                onChange={(e) => onSelectFY(e.target.value)}
              >
                <option value="">Select Financial Year</option>
                {FY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </Field>

            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius)', background: 'var(--surface-sunken)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--brand)', marginBottom: 8 }}>
                Invoice Settings
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Invoice Prefix">
                  <input
                    type="text"
                    className="field__control"
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                    placeholder="INV"
                  />
                </Field>
                <Field label="Start Number">
                  <input
                    type="number"
                    min="1"
                    className="field__control"
                    value={invoiceStartNumber}
                    onChange={(e) => setInvoiceStartNumber(e.target.value)}
                    placeholder="1"
                  />
                </Field>
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius)', background: 'var(--surface-sunken)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--gold, #d97706)', marginBottom: 8 }}>
                Receipt Settings
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Receipt Prefix">
                  <input
                    type="text"
                    className="field__control"
                    value={receiptPrefix}
                    onChange={(e) => setReceiptPrefix(e.target.value.toUpperCase())}
                    placeholder="REC"
                  />
                </Field>
                <Field label="Start Number">
                  <input
                    type="number"
                    min="1"
                    className="field__control"
                    value={receiptStartNumber}
                    onChange={(e) => setReceiptStartNumber(e.target.value)}
                    placeholder="1"
                  />
                </Field>
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius)', background: 'var(--surface-sunken)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sea, #0284c7)', marginBottom: 8 }}>
                Voucher Settings
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Voucher Prefix">
                  <input
                    type="text"
                    className="field__control"
                    value={voucherPrefix}
                    onChange={(e) => setVoucherPrefix(e.target.value.toUpperCase())}
                    placeholder="VOU"
                  />
                </Field>
                <Field label="Start Number">
                  <input
                    type="number"
                    min="1"
                    className="field__control"
                    value={voucherStartNumber}
                    onChange={(e) => setVoucherStartNumber(e.target.value)}
                    placeholder="1"
                  />
                </Field>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn--brand">
                {editing ? 'Save changes' : 'Add financial year'}
              </button>
              {editing && (
                <button type="button" className="btn btn--text" onClick={reset}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Sheet>

        <div className="list">
          <h2 className="list__title">
            Financial periods <span>{list.length}</span>
          </h2>

          <ListSearch value={q} onChange={setQ} placeholder="Search financial years..." />
          {q && filtered.length === 0 && list.length > 0 && <NoMatch query={q} />}

          {list.length === 0 ? (
            <div className="empty">
              <b>No financial years set.</b>
              Use the form on the left to set your chapter's fiscal year.
            </div>
          ) : (
            filtered.map((y) => {
              const lockInfo = isYearInUse(y)
              const isCurrentActive = activeYear?.id === y.id

              return (
                <article key={y.id} className="row" style={{ opacity: lockInfo.inUse ? 0.85 : 1 }}>
                  <div className="row__acts">
                    {lockInfo.inUse ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled
                        title={lockInfo.reason}
                        style={{
                          padding: '6px 8px',
                          color: 'var(--ink-mute)',
                          opacity: 0.5,
                          cursor: 'not-allowed',
                        }}
                      >
                        <Lock size={15} />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          title="Edit year"
                          aria-label={`Edit ${y.title}`}
                          onClick={() => startEdit(y)}
                          style={{ padding: '6px 8px' }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          title="Delete year"
                          aria-label={`Delete ${y.title}`}
                          onClick={() => remove(y)}
                          style={{ padding: '6px 8px', color: '#ef4444' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>

                  <Glyph icon={CalendarClock} tone={isCurrentActive ? 'gold' : 'steel'} size={50} />

                  <div className="row__main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b>{y.title}</b>
                      {isCurrentActive && (
                        <span className="chip chip--green" style={{ fontSize: 11.5 }}>
                          Active Year
                        </span>
                      )}
                      {lockInfo.inUse && (
                        <span
                          className="chip chip--wine"
                          style={{ fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title={lockInfo.reason}
                        >
                          <Lock size={11} /> Locked
                        </span>
                      )}
                    </div>
                    <span>
                      {fmtDate(y.startDate)} – {fmtDate(y.endDate)}
                    </span>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--ink-mute)', marginTop: 2 }}>
                      <span>Inv: <b>{y.invoicePrefix || 'INV'}-#{y.invoiceStartNumber ?? y.billStartNumber ?? 1}</b></span>
                      <span>·</span>
                      <span>Rec: <b>{y.receiptPrefix || 'REC'}-#{y.receiptStartNumber ?? 1}</b></span>
                      <span>·</span>
                      <span>Vou: <b>{y.voucherPrefix || 'VOU'}-#{y.voucherStartNumber ?? 1}</b></span>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
