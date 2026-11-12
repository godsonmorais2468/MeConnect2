import { useState } from 'react'
import type { FormEvent } from 'react'
import { CreditCard, Pencil, Plus, Trash2 } from 'lucide-react'
import CpHero, { Fold, NewButton, Nums } from '../../components/CpHero'
import { Field, FieldGroup, Toggle } from '../../components/ui'
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
  /* the form: open when there are no modes yet, and shut after that until it is asked for */
  const [composeOpt, setComposeOpt] = useState<boolean | null>(null)

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
    setComposeOpt(false)
  }

  function startEdit(m: ModeOfPay) {
    setComposeOpt(true)
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

  const compose = composeOpt ?? list.length === 0

  return (
    <div className="page md">
      <CpHero className="md-hero" icon={CreditCard} eyebrow={`${chapter.name} · ${member.designation}`} title="Mode of Pay" sub="Accepted modes of payment (UPI, Cheque, Cash, Net Banking, POS) for chapter collections." back={{ to: '/accounts', label: 'Accounts' }}>
        <div className="cx-side">
          <Nums
            items={[
              [list.length, 'modes'],
              [list.filter((m) => m.isActive).length, 'active'],
            ]}
          />
          <NewButton open={compose} label="New mode" controls="md-fold" onClick={() => (compose ? reset() : setComposeOpt(true))} />
        </div>
      </CpHero>

      <Fold id="md-fold" open={compose} label="Payment mode form">
        <form className="cp-form" onSubmit={submit} noValidate>
          <h2 className="cp-form__h">
            {editing ? <Pencil size={17} /> : <Plus size={17} />} {editing ? 'Edit payment mode' : 'New payment mode'}
          </h2>
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
            <select className="field__control" value={code} onChange={(e) => setCode(e.target.value)}>
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

          <FieldGroup label="Status">
            <label className="cp-switch">
              <Toggle checked={isActive} onChange={setIsActive} label="Active mode" />
              <span>{isActive ? 'Active (available for collections)' : 'Disabled'}</span>
            </label>
          </FieldGroup>

          <div className="cp-wide">
            <Field label="Description / Instructions" error={errors.description} hint="Instructions shown to members or coordinators">
              <textarea className="field__control field__control--area" rows={2} value={description} placeholder="Details or guidelines for this payment method..." onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>

          <div className="cp-form__foot">
            {editing && (
              <button type="button" className="cp-btn cp-btn--ghost" onClick={reset}>
                Cancel
              </button>
            )}
            <button type="submit" className="cp-btn">
              {editing ? 'Save changes' : 'Add mode of pay'}
            </button>
          </div>
        </form>
      </Fold>

      <div className="cp-bar">
        <ListSearch value={q} onChange={setQ} placeholder="Search payment modes, ledgers..." />
      </div>
      {q && filtered.length === 0 && list.length > 0 && <NoMatch query={q} />}

      {list.length === 0 ? (
        <div className="cp-empty">
          <CreditCard size={30} />
          <b>No payment modes yet</b>
          <span>Add your first payment mode with the button above.</span>
        </div>
      ) : (
        <ul className="md-grid">
          {filtered.map((m) => (
            <li key={m.id} className={`md-tile${m.isActive ? '' : ' is-off'}${editing === m.id ? ' is-editing' : ''}`}>
              <div className="md-tile__top">
                <span className="md-tile__ico">
                  <CreditCard size={22} />
                </span>
                <span className={`md-tile__lamp${m.isActive ? ' is-on' : ''}`}>{m.isActive ? 'Active' : 'Disabled'}</span>
              </div>
              <b>{m.name}</b>
              <span className="md-tile__ledger">Ledger: {m.code || 'Cash'}</span>
              <p>{m.description || 'No description provided'}</p>
              <div className="cp-acts">
                <button type="button" className="cp-act" title="Edit mode" aria-label={`Edit ${m.name}`} onClick={() => startEdit(m)}>
                  <Pencil size={14} /> Edit
                </button>
                <button type="button" className="cp-act cp-act--icon cp-act--danger" title="Delete mode" aria-label={`Delete ${m.name}`} onClick={() => remove(m)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
