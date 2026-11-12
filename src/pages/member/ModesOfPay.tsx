import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, CreditCard, Pencil, Plus, Trash2 } from 'lucide-react'
import { Field, FieldGroup, Glyph, PageHead, Sheet, StatStrip, Toggle } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { createModeOfPay, deleteModeOfPay, updateModeOfPay, useDB } from '../../lib/store'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import type { ModeOfPay } from '../../lib/types'
import { showFormIfHidden } from '../../lib/scroll'

export default function ModesOfPay() {
  const { member, chapter } = useAuth()
  const db = useDB()
  const [q, setQ] = useState('')
  const toast = useToast()
  const confirm = useConfirm()

  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('Cash')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!member || !chapter) return null

  const list = (db.paymentModes || []).filter((m) => m.chapterId === chapter.id)
  const banks = (db.bankAccounts || []).filter((b) => b.chapterId === chapter.id && b.isActive)
  const filtered = list.filter((m) => matches(q, m.name, m.code, m.description))

  function reset() {
    setEditing(null)
    setName('')
    setCode('Cash')
    setDescription('')
    setIsActive(true)
    setErrors({})
  }

  function startEdit(m: ModeOfPay) {
    setEditing(m.id)
    setName(m.name)
    setCode(m.code || 'Cash')
    setDescription(m.description || '')
    setIsActive(m.isActive)
    setErrors({})
    showFormIfHidden()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!chapter) return

    const input = {
      regionId: chapter.regionId,
      chapterId: chapter.id,
      name,
      code: code || 'Cash',
      description,
      isActive,
    }

    const res = editing ? await updateModeOfPay(editing, input) : await createModeOfPay(input)

    if (res.error) {
      if (res.field) setErrors({ [res.field]: res.error })
      else toast(res.error, 'info')
      return
    }

    toast(`Payment mode "${name}" ${editing ? 'updated' : 'saved'}`)
    reset()
  }

  async function remove(m: ModeOfPay) {
    const ok = await confirm({
      title: 'Delete Payment Mode?',
      message: `Are you sure you want to delete "${m.name}"? This cannot be undone.`,
    })
    if (!ok) return

    const res = await deleteModeOfPay(m.id)
    if (res.error) {
      toast(res.error, 'info')
      return
    }
    toast(`Payment mode "${m.name}" deleted`)
    if (editing === m.id) reset()
  }

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={CreditCard}
        tone="navy"
        title="Mode of Pay"
        subtitle="Manage accepted modes of payment (UPI, Cheque, Cash, Net Banking, POS) for chapter collections."
        actions={
          <Link className="btn btn--line btn--sm" to="/accounts">
            <ArrowLeft size={16} /> Accounts
          </Link>
        }
      />

      <StatStrip
        items={[
          { icon: CreditCard, tone: 'navy', label: 'Total Modes', value: list.length },
          { icon: CheckCircle2, tone: 'green', label: 'Active Modes', value: list.filter((m) => m.isActive).length },
        ]}
      />

      <div className="duo">
        <Sheet
          icon={editing ? Pencil : Plus}
          tone="navy"
          title={editing ? 'Edit payment mode' : 'New payment mode'}
          note={chapter.name}
        >
          <form className="form-stack" onSubmit={submit} noValidate>
            <Field label="Mode Name" error={errors.name} required hint="e.g. UPI, Cheque, Cash, Bank Transfer, POS">
              <input
                className="field__control"
                value={name}
                placeholder="UPI / Cheque / Cash"
                onChange={(e) => {
                  setName(e.target.value)
                  if (errors.name) setErrors({})
                }}
              />
            </Field>

            <Field label="Ledger" error={errors.code} hint="Account ledger linked to this payment mode">
              <select
                className="field__control"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              >
                <option value="Cash">Cash</option>
                {banks.map((b) => {
                  const label = b.accountNumber ? `${b.bankName} - ${b.accountNumber}` : b.bankName
                  return (
                    <option key={b.id} value={label}>
                      {label}
                    </option>
                  )
                })}
              </select>
            </Field>

            <Field label="Description / Instructions" error={errors.description} hint="Instructions shown to members or coordinators">
              <textarea
                className="field__control field__control--area"
                rows={2}
                value={description}
                placeholder="Details or guidelines for this payment method..."
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>

            <FieldGroup label="Status">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <Toggle checked={isActive} onChange={setIsActive} label="Active mode" />
                <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                  {isActive ? 'Active (available for collections)' : 'Disabled'}
                </span>
              </label>
            </FieldGroup>

            <div className="form-actions">
              <button type="submit" className="btn btn--brand">
                {editing ? 'Save changes' : 'Add mode of pay'}
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
            Payment modes <span>{list.length}</span>
          </h2>

          <ListSearch value={q} onChange={setQ} placeholder="Search payment modes, ledgers..." />
          {q && filtered.length === 0 && list.length > 0 && <NoMatch query={q} />}

          {list.length === 0 ? (
            <div className="empty">
              <b>No payment modes yet.</b>
              Use the form on the left to add your first payment mode.
            </div>
          ) : (
            filtered.map((m) => (
              <article key={m.id} className="row" style={{ opacity: m.isActive ? 1 : 0.75 }}>
                <div className="row__acts">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    title="Edit mode"
                    aria-label={`Edit ${m.name}`}
                    onClick={() => startEdit(m)}
                    style={{ padding: '6px 8px' }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    title="Delete mode"
                    aria-label={`Delete ${m.name}`}
                    onClick={() => remove(m)}
                    style={{ padding: '6px 8px', color: '#ef4444' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <Glyph icon={CreditCard} tone={m.isActive ? 'navy' : 'steel'} size={50} />

                <div className="row__main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <b>{m.name}</b>
                    <span className="chip chip--steel" style={{ fontSize: 11.5 }}>
                      Ledger: {m.code || 'Cash'}
                    </span>
                    <span className={`chip ${m.isActive ? 'chip--green' : 'chip--steel'}`}>
                      {m.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <span>{m.description || 'No description provided'}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
