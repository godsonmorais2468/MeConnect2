import { useState } from 'react'
import type { FormEvent } from 'react'
import { Landmark, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import CpHero, { Fold, NewButton, Nums } from '../../components/CpHero'
import { Field, FieldGroup, Toggle } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { createBankMaster, deleteBankMaster, updateBankMaster, useDB } from '../../lib/store'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import { inr } from '../../lib/format'
import type { BankMaster } from '../../lib/types'
import { showFormIfHidden } from '../../lib/scroll'

export default function BankAccounts() {
  const { member, chapter } = useAuth()
  const db = useDB()
  const [q, setQ] = useState('')
  const toast = useToast()
  const confirm = useConfirm()

  const [editing, setEditing] = useState<string | null>(null)
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [branch, setBranch] = useState('')
  const [upiId, setUpiId] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  /* the form: open when there are no accounts yet, and shut after that until it is asked for */
  const [composeOpt, setComposeOpt] = useState<boolean | null>(null)

  if (!member || !chapter) return null

  const list = (db.bankAccounts || []).filter((b) => b.chapterId === chapter.id)
  const filtered = list.filter((b) => matches(q, b.bankName, b.accountName, b.accountNumber, b.ifscCode, b.branch, b.upiId))

  function reset() {
    setEditing(null)
    setBankName('')
    setAccountName('')
    setAccountNumber('')
    setIfscCode('')
    setBranch('')
    setUpiId('')
    setOpeningBalance('')
    setIsDefault(false)
    setIsActive(true)
    setErrors({})
    setComposeOpt(false)
  }

  function startEdit(b: BankMaster) {
    setComposeOpt(true)
    setEditing(b.id)
    setBankName(b.bankName)
    setAccountName(b.accountName)
    setAccountNumber(b.accountNumber)
    setIfscCode(b.ifscCode || '')
    setBranch(b.branch || '')
    setUpiId(b.upiId || '')
    setOpeningBalance(b.openingBalance ? String(b.openingBalance) : '')
    setIsDefault(b.isDefault)
    setIsActive(b.isActive)
    setErrors({})
    showFormIfHidden()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!chapter) return

    const input = {
      regionId: chapter.regionId,
      chapterId: chapter.id,
      bankName,
      accountName,
      accountNumber,
      ifscCode,
      branch,
      upiId,
      openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
      isDefault,
      isActive,
    }

    const res = editing ? await updateBankMaster(editing, input) : await createBankMaster(input)

    if (res.error) {
      if (res.field) setErrors({ [res.field]: res.error })
      else toast(res.error, 'info')
      return
    }

    toast(`Bank account "${bankName}" ${editing ? 'updated' : 'saved'}`)
    reset()
  }

  async function remove(b: BankMaster) {
    const ok = await confirm({
      title: 'Delete Bank Account?',
      message: `Are you sure you want to delete ${b.bankName} (${b.accountNumber})?`,
    })
    if (!ok) return

    const res = await deleteBankMaster(b.id)
    if (res.error) {
      toast(res.error, 'info')
      return
    }
    toast(`Bank account "${b.bankName}" deleted`)
    if (editing === b.id) reset()
  }

  const compose = composeOpt ?? list.length === 0
  const opening = list.reduce((n, b) => n + (b.openingBalance || 0), 0)

  return (
    <div className="page bk">
      <CpHero className="bk-hero" icon={Landmark} eyebrow={`${chapter.name} · ${member.designation}`} title="Bank Master" sub="Chapter bank accounts, IFSC codes, branches, linked UPI IDs and opening balances." back={{ to: '/accounts', label: 'Accounts' }}>
        <div className="cx-side">
          <Nums
            items={[
              [list.length, 'accounts'],
              [list.filter((b) => b.isActive).length, 'active'],
              [inr(opening), 'opening'],
            ]}
          />
          <NewButton open={compose} label="New account" controls="bk-fold" onClick={() => (compose ? reset() : setComposeOpt(true))} />
        </div>
      </CpHero>

      <Fold id="bk-fold" open={compose} label="Bank account form">
        <form className="cp-form" onSubmit={submit} noValidate>
          <h2 className="cp-form__h">
            {editing ? <Pencil size={17} /> : <Plus size={17} />} {editing ? 'Edit bank account' : 'New bank account'}
          </h2>
          <Field label="Bank Name" error={errors.bankName} required hint="e.g. HDFC Bank, SBI, ICICI Bank">
            <input
              className="field__control"
              value={bankName}
              placeholder="HDFC Bank"
              onChange={(e) => {
                setBankName(e.target.value)
                if (errors.bankName) setErrors({})
              }}
            />
          </Field>

          <Field label="Account Holder Name" error={errors.accountName} hint="Optional name as in bank records">
            <input
              className="field__control"
              value={accountName}
              placeholder="ME-CONNECT Account"
              onChange={(e) => {
                setAccountName(e.target.value)
                if (errors.accountName) setErrors({})
              }}
            />
          </Field>

          <Field label="Account Number" error={errors.accountNumber} hint="Optional account number">
            <input
              className="field__control"
              value={accountNumber}
              placeholder="50100234567890"
              onChange={(e) => {
                setAccountNumber(e.target.value)
                if (errors.accountNumber) setErrors({})
              }}
            />
          </Field>

          <Field label="IFSC Code" error={errors.ifscCode}>
            <input className="field__control" value={ifscCode} placeholder="HDFC0001234" onChange={(e) => setIfscCode(e.target.value.toUpperCase())} />
          </Field>

          <Field label="Branch Name" error={errors.branch}>
            <input className="field__control" value={branch} placeholder="Kochi Main Branch" onChange={(e) => setBranch(e.target.value)} />
          </Field>

          <Field label="Linked UPI ID" error={errors.upiId} hint="Optional UPI handle">
            <input className="field__control" value={upiId} placeholder="chapter@okhdfcbank" onChange={(e) => setUpiId(e.target.value)} />
          </Field>

          <Field label="Opening Balance (₹)" error={errors.openingBalance}>
            <input type="number" step="0.01" className="field__control" value={openingBalance} placeholder="0.00" onChange={(e) => setOpeningBalance(e.target.value)} />
          </Field>

          <FieldGroup label="Status">
            <label className="cp-switch">
              <Toggle checked={isActive} onChange={setIsActive} label="Active account" />
              <span>{isActive ? 'Active (available for collections)' : 'Disabled'}</span>
            </label>
          </FieldGroup>

          <div className="cp-form__foot">
            {editing && (
              <button type="button" className="cp-btn cp-btn--ghost" onClick={reset}>
                Cancel
              </button>
            )}
            <button type="submit" className="cp-btn">
              {editing ? 'Save changes' : 'Add bank account'}
            </button>
          </div>
        </form>
      </Fold>

      <div className="cp-bar">
        <ListSearch value={q} onChange={setQ} placeholder="Search accounts, IFSC, branch..." />
      </div>
      {q && filtered.length === 0 && list.length > 0 && <NoMatch query={q} />}

      {list.length === 0 ? (
        <div className="cp-empty">
          <Landmark size={30} />
          <b>No bank accounts registered</b>
          <span>Add your chapter's official bank account with the button above.</span>
        </div>
      ) : (
        <ul className="bk-grid">
          {filtered.map((b) => (
            <li key={b.id} className={`bk-card${b.isDefault ? ' is-primary' : ''}${b.isActive ? '' : ' is-off'}${editing === b.id ? ' is-editing' : ''}`}>
              <div className="bk-face">
                <header>
                  <Landmark size={18} />
                  <b>{b.bankName}</b>
                  {b.isDefault && (
                    <span className="bk-face__tag">
                      <Star size={11} /> Primary
                    </span>
                  )}
                  {!b.isActive && <span className="bk-face__tag bk-face__tag--off">Disabled</span>}
                </header>
                <p className="bk-face__no">{b.accountNumber ? b.accountNumber.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim() : '•••• •••• ••••'}</p>
                <footer>
                  <span>
                    <small>Account holder</small>
                    {b.accountName || '—'}
                  </span>
                  <span>
                    <small>Opening</small>
                    {inr(b.openingBalance)}
                  </span>
                </footer>
              </div>
              <dl className="bk-meta">
                <div>
                  <dt>IFSC</dt>
                  <dd>{b.ifscCode || '—'}</dd>
                </div>
                <div>
                  <dt>Branch</dt>
                  <dd>{b.branch || '—'}</dd>
                </div>
                <div>
                  <dt>UPI</dt>
                  <dd>{b.upiId || '—'}</dd>
                </div>
              </dl>
              <div className="cp-acts">
                <button type="button" className="cp-act" title="Edit account" aria-label={`Edit ${b.bankName}`} onClick={() => startEdit(b)}>
                  <Pencil size={14} /> Edit
                </button>
                <button type="button" className="cp-act cp-act--icon cp-act--danger" title="Delete account" aria-label={`Delete ${b.bankName}`} onClick={() => remove(b)}>
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
