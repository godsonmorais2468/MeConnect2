import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Download, FileText, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { Field, Glyph, PageHead, Sheet, StatStrip } from '../../components/ui'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { useAuth } from '../../lib/auth'
import { useConfirm } from '../../lib/confirm'
import { dayOf } from '../../lib/dues'
import { fmtDate, inr } from '../../lib/format'
import { headsOf } from '../../lib/heads'
import { downloadVoucher } from '../../lib/invoicePdf'
import { useNow } from '../../lib/hooks'
import { modesOf } from '../../lib/payments'
import { matches } from '../../lib/search'
import { createVoucher, deleteVoucher, updateVoucher, useDB } from '../../lib/store'
import { useToast } from '../../lib/toast'
import { previewNumber, yearFor } from '../../lib/vouchers'
import type { Voucher, VoucherKind } from '../../lib/types'
import { showFormIfHidden } from '../../lib/scroll'

const COPY = {
  payment: {
    title: 'Payment Vouchers',
    word: 'Expense',
    subtitle: 'Record expenses the chapter paid. The voucher number comes from the financial year settings.',
    head: 'Expense head',
    headType: 'expense' as const,
    icon: ArrowUpRight,
    tone: 'red' as const,
    numberLabel: 'Voucher No.',
    empty: 'No payment vouchers yet. Use the form to record the first expense.',
  },
  receipt: {
    title: 'Receipt Vouchers',
    word: 'Income',
    subtitle: 'Record income the chapter received. Receipt numbers continue the same sequence as member receipts.',
    head: 'Income head',
    headType: 'income' as const,
    icon: ArrowDownLeft,
    tone: 'green' as const,
    numberLabel: 'Receipt No.',
    empty: 'No receipt vouchers yet. Use the form to record the first income.',
  },
}

/** Payment vouchers (expense) or receipt vouchers (income): a form to record one and the list of those recorded. */
export default function VoucherBook({ kind }: { kind: VoucherKind }) {
  const { member, chapter } = useAuth()
  const db = useDB()
  const toast = useToast()
  const confirm = useConfirm()
  const now = useNow(60_000)
  const today = dayOf(now)
  const copy = COPY[kind]

  const [editing, setEditing] = useState<Voucher | null>(null)
  const [date, setDate] = useState('')
  const [headId, setHeadId] = useState('')
  const [amount, setAmount] = useState('')
  const [modeName, setModeName] = useState('')
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')

  if (!member || !chapter) return null
  const when = date || today
  const heads = headsOf(db, chapter.id).filter((h) => h.headType === copy.headType && (h.isActive || h.id === editing?.headId))
  const modes = modesOf(db, chapter.id)
  const list = (db.vouchers || []).filter((v) => v.chapterId === chapter.id && v.kind === kind)
  const shown = list.filter((v) => matches(q, v.number, v.headName, v.modeName, v.remarks, v.amount, v.date, v.financialYearTitle))
  const total = list.reduce((n, v) => n + v.amount, 0)
  /* the financial year and number shown are what the settings give for the chosen date; the server confirms them on save */
  const preview = previewNumber(db, chapter.id, kind, when)
  const year = editing ? undefined : preview.year
  const editYear = editing ? (db.financialYears || []).find((y) => y.id === editing.financialYearId) : undefined

  function reset() {
    setEditing(null)
    setDate('')
    setHeadId('')
    setAmount('')
    setModeName('')
    setRemarks('')
    setErrors({})
  }

  function startEdit(v: Voucher) {
    setEditing(v)
    setDate(v.date)
    setHeadId(v.headId)
    setAmount(String(v.amount))
    setModeName(v.modeName)
    setRemarks(v.remarks)
    setErrors({})
    showFormIfHidden()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving || !chapter) return
    const next: Record<string, string> = {}
    const money = Number(amount)
    if (!headId) next.headId = `Select the ${copy.head.toLowerCase()}.`
    if (!(money > 0)) next.amount = 'Enter the amount.'
    if (!modeName) next.modeName = 'Select the mode of pay.'
    if (!remarks.trim()) next.remarks = 'Enter the remarks.'
    if (!editing && !yearFor(db, chapter.id, when)) next.date = 'No financial year covers this date. Set one up in Accounts > Financial Year Settings.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    const input = { date: when, headId, amount: money, modeName, remarks: remarks.trim() }
    const res = editing ? await updateVoucher(editing.id, input) : await createVoucher({ chapterId: chapter.id, kind, ...input })
    setSaving(false)
    if (res.error) return setErrors({ [res.field ?? 'form']: res.error })
    toast(editing ? `${editing.number} updated` : `${copy.title.replace(/s$/, '')} recorded`)
    reset()
  }

  async function remove(v: Voucher) {
    if (!(await confirm({ title: 'Delete voucher?', message: `${v.number} (${inr(v.amount)}) will be removed. Its number is not reused unless it was the latest.` }))) return
    const res = await deleteVoucher(v.id)
    if (res.error) return toast(res.error, 'info')
    toast(`${v.number} deleted`)
    if (editing?.id === v.id) reset()
  }

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={copy.icon}
        tone={copy.tone}
        title={`${copy.title} (${copy.word})`}
        subtitle={copy.subtitle}
        actions={
          <Link className="btn btn--line btn--sm" to="/accounts/vouchers">
            <ArrowLeft size={16} /> Vouchers
          </Link>
        }
      />

      <StatStrip
        items={[
          { icon: FileText, tone: 'gold', label: 'Vouchers', value: list.length },
          { icon: copy.icon, tone: copy.tone, label: `Total ${copy.word.toLowerCase()}`, value: inr(total) },
        ]}
      />

      <div className="att">
        <Sheet icon={editing ? Pencil : Plus} tone={copy.tone} title={editing ? `Edit ${editing.number}` : `New ${copy.title.replace(/s$/, '').toLowerCase()}`} note={chapter.name}>
          <form className="form-stack" onSubmit={submit} noValidate>
            <div className="form-grid">
              <Field label="Financial year" hint="From the financial year settings">
                <input className="field__control" value={editing ? editYear?.title ?? editing.financialYearTitle : (year?.title ?? 'None for this date')} readOnly disabled />
              </Field>
              <Field label={copy.numberLabel} hint="Given automatically when saved">
                <input className="field__control" value={editing ? editing.number : preview.number || '-'} readOnly disabled />
              </Field>
            </div>

            <Field label="Date" required error={errors.date}>
              <input
                className="field__control"
                type="date"
                value={when}
                min={editing ? editYear?.startDate : undefined}
                max={editing ? editYear?.endDate : undefined}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>

            <Field label={copy.head} required error={errors.headId} hint={heads.length ? undefined : `Add an ${copy.headType} head in Income & Expense Heads first.`}>
              <select className="field__control native-select" value={headId} onChange={(e) => setHeadId(e.target.value)}>
                <option value="">Select {copy.head.toLowerCase()}</option>
                {heads.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="form-grid">
              <Field label="Amount (₹)" required error={errors.amount}>
                <input className="field__control" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 500" />
              </Field>
              <Field label="Mode of pay" required error={errors.modeName}>
                <select className="field__control native-select" value={modeName} onChange={(e) => setModeName(e.target.value)}>
                  <option value="">Select mode of pay</option>
                  {[...modes, ...(modeName && !modes.includes(modeName) ? [modeName] : [])].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Remarks" required error={errors.remarks} hint="What this voucher is for">
              <textarea className="field__control" rows={2} maxLength={300} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Hall rent for October meetings" />
            </Field>

            {errors.form && <div className="form-error">{errors.form}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn--primary" type="submit" disabled={saving}>
                {editing ? <Pencil size={16} /> : <Plus size={16} />} {saving ? 'Saving…' : editing ? 'Update voucher' : 'Save voucher'}
              </button>
              {editing && (
                <button className="btn btn--ghost" type="button" onClick={reset}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Sheet>

        <div className="list">
          <h2 className="list__title">
            {copy.title} <span>{list.length}</span>
          </h2>
          <ListSearch value={q} onChange={setQ} placeholder="Search by number, head, mode, remarks or amount" />
          {q && shown.length === 0 && list.length > 0 && <NoMatch query={q} />}
          {list.length === 0 ? (
            <div className="empty">
              <b>Nothing recorded yet.</b>
              {copy.empty}
            </div>
          ) : (
            shown.map((v) => (
              <article key={v.id} className="row">
                <div className="row__acts">
                  <button type="button" className="btn btn--ghost btn--sm" title="Download voucher" aria-label={`Download ${v.number}`} onClick={() => downloadVoucher({ voucher: v, chapter, region: db.regions.find((r) => r.id === chapter.regionId) ?? null })} style={{ padding: '6px 8px' }}>
                    <Download size={15} />
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" title="Edit voucher" aria-label={`Edit ${v.number}`} onClick={() => startEdit(v)} style={{ padding: '6px 8px' }}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" title="Delete voucher" aria-label={`Delete ${v.number}`} onClick={() => remove(v)} style={{ padding: '6px 8px', color: '#ef4444' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <Glyph icon={Receipt} tone={copy.tone} size={50} />
                <div className="row__main">
                  <b>{v.number}</b>
                  <span>{v.headName}</span>
                  <span>
                    {fmtDate(v.date)} · {v.modeName}
                  </span>
                  {v.remarks && <span>Remarks: {v.remarks}</span>}
                </div>
                <div className="chips">
                  <span className="chip">{v.financialYearTitle}</span>
                  <span className={`headkind ${kind === 'receipt' ? 'headkind--income' : 'headkind--expense'}`}>{inr(v.amount)}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
