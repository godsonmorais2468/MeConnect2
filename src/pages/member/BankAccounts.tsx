import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { Field, FieldGroup, Glyph, PageHead, Sheet, StatStrip, Toggle } from '../../components/ui'
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
  }

  function startEdit(b: BankMaster) {
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

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={Landmark}
        tone="green"
        title="Bank Master"
        subtitle="Manage chapter bank accounts, IFSC codes, branches, linked UPI IDs, and opening balances."
        actions={
          <Link className="btn btn--line btn--sm" to="/accounts">
            <ArrowLeft size={16} /> Accounts
          </Link>
        }
      />

      <StatStrip
        items={[
          { icon: Landmark, tone: 'green', label: 'Bank Accounts', value: list.length },
          { icon: CheckCircle2, tone: 'navy', label: 'Active Accounts', value: list.filter((b) => b.isActive).length },
        ]}
      />

      <div className="duo">
        <Sheet
          icon={editing ? Pencil : Plus}
          tone="green"
          title={editing ? 'Edit bank account' : 'New bank account'}
          note={chapter.name}
        >
          <form className="form-stack" onSubmit={submit} noValidate>
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

            <div className="form-grid">
              <Field label="IFSC Code" error={errors.ifscCode}>
                <input
                  className="field__control"
                  value={ifscCode}
                  placeholder="HDFC0001234"
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                />
              </Field>

              <Field label="Branch Name" error={errors.branch}>
                <input
                  className="field__control"
                  value={branch}
                  placeholder="Kochi Main Branch"
                  onChange={(e) => setBranch(e.target.value)}
                />
              </Field>
            </div>

            <div className="form-grid">
              <Field label="Linked UPI ID" error={errors.upiId} hint="Optional UPI handle">
                <input
                  className="field__control"
                  value={upiId}
                  placeholder="chapter@okhdfcbank"
                  onChange={(e) => setUpiId(e.target.value)}
                />
              </Field>

              <Field label="Opening Balance (₹)" error={errors.openingBalance}>
                <input
                  type="number"
                  step="0.01"
                  className="field__control"
                  value={openingBalance}
                  placeholder="0.00"
                  onChange={(e) => setOpeningBalance(e.target.value)}
                />
              </Field>
            </div>

            <FieldGroup label="Status">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <Toggle checked={isActive} onChange={setIsActive} label="Active account" />
                <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                  {isActive ? 'Active (available for collections)' : 'Disabled'}
                </span>
              </label>
            </FieldGroup>

            <div className="form-actions">
              <button type="submit" className="btn btn--brand">
                {editing ? 'Save changes' : 'Add bank account'}
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
            Bank accounts <span>{list.length}</span>
          </h2>

          <ListSearch value={q} onChange={setQ} placeholder="Search accounts, IFSC, branch..." />
          {q && filtered.length === 0 && list.length > 0 && <NoMatch query={q} />}

          {list.length === 0 ? (
            <div className="empty">
              <b>No bank accounts registered.</b>
              Use the form on the left to add your chapter's official bank account.
            </div>
          ) : (
            filtered.map((b) => (
              <article key={b.id} className="row" style={{ opacity: b.isActive ? 1 : 0.75 }}>
                <div className="row__acts">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    title="Edit account"
                    aria-label={`Edit ${b.bankName}`}
                    onClick={() => startEdit(b)}
                    style={{ padding: '6px 8px' }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    title="Delete account"
                    aria-label={`Delete ${b.bankName}`}
                    onClick={() => remove(b)}
                    style={{ padding: '6px 8px', color: '#ef4444' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <Glyph icon={Landmark} tone={b.isDefault ? 'green' : 'navy'} size={50} />

                <div className="row__main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <b>{b.bankName}</b>
                    {b.isDefault && (
                      <span className="chip chip--green" style={{ fontSize: 11.5 }}>
                        Primary
                      </span>
                    )}
                    {!b.isActive && (
                      <span className="chip chip--steel" style={{ fontSize: 11.5 }}>
                        Disabled
                      </span>
                    )}
                  </div>
                  {(b.accountNumber || b.accountName) && (
                    <span style={{ marginTop: 2 }}>
                      {b.accountNumber && (
                        <>
                          A/C: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{b.accountNumber}</span>
                        </>
                      )}
                      {b.accountNumber && b.accountName && ' · '}
                      {b.accountName}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>
                    {b.ifscCode && <>IFSC: {b.ifscCode} · </>}
                    {b.branch && <>Branch: {b.branch} · </>}
                    {b.upiId && <>UPI: {b.upiId} · </>}
                    Opening: {inr(b.openingBalance)}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
