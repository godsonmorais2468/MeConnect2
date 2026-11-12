import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Layers, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import CpHero, { Fold, NewButton, Nums } from '../../components/CpHero'
import { Field, FieldGroup, Toggle } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { headsOf } from '../../lib/heads'
import { createAccountHead, deleteAccountHead, updateAccountHead, useDB } from '../../lib/store'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import type { AccountHead, HeadType } from '../../lib/types'
import { showFormIfHidden } from '../../lib/scroll'

export default function AccountHeads() {
  const { member, chapter, role } = useAuth()
  /* The super admin sets the defaults every chapter gets; a head table member sees them locked and adds their own on top. */
  const isSuper = role === 'super_admin'
  const chapterId = chapter?.id ?? ''
  const db = useDB()
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const toast = useToast()
  const confirm = useConfirm()

  const [editing, setEditing] = useState<string | null>(null)
  const [headType, setHeadType] = useState<HeadType>('income')
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  /* the form: open when there are no heads yet, and shut after that until it is asked for */
  const [composeOpt, setComposeOpt] = useState<boolean | null>(null)

  if (!isSuper && (!member || !chapter)) return null

  const list = isSuper ? (db.accountHeads || []).filter((h) => !h.chapterId) : headsOf(db, chapterId)
  const incomes = list.filter((h) => h.headType === 'income')
  const expenses = list.filter((h) => h.headType === 'expense')

  const filtered = list
    .filter((h) => (typeFilter === 'all' ? true : h.headType === typeFilter))
    .filter((h) => matches(q, h.name, h.comment, h.headType))

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  // Reset to first page when search query or type filter changes
  useEffect(() => {
    setPage(1)
  }, [q, typeFilter])

  // If page exceeds totalPages due to deletion, adjust back
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [totalPages, page])

  function reset() {
    setEditing(null)
    setHeadType('income')
    setName('')
    setComment('')
    setIsActive(true)
    setErrors({})
    setComposeOpt(false)
  }

  function startEdit(h: AccountHead) {
    setComposeOpt(true)
    setEditing(h.id)
    setHeadType(h.headType)
    setName(h.name)
    setComment(h.comment || '')
    setIsActive(h.isActive)
    setErrors({})
    showFormIfHidden()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrors({ name: 'Enter the head name.' })
      return
    }

    const input = {
      regionId: chapter?.regionId ?? '',
      chapterId,
      headType,
      name: trimmedName,
      comment: comment.trim(),
      isActive,
    }

    const res = editing ? await updateAccountHead(editing, input) : await createAccountHead(input)
    if (res.error) {
      setErrors({ [res.field ?? 'form']: res.error })
      return
    }

    toast(`${headType === 'income' ? 'Income' : 'Expense'} head "${trimmedName}" ${editing ? 'updated' : 'saved'}`)
    /* the list below switches to the kind just saved, so it shows right away */
    setTypeFilter(headType)
    reset()
  }

  async function remove(h: AccountHead) {
    if (
      !(await confirm({
        title: `Delete ${h.headType} head?`,
        message: `"${h.name}" will be removed. This cannot be undone.`,
      }))
    )
      return

    const res = await deleteAccountHead(h.id)
    if (res.error) return toast(res.error, 'info')

    toast(`${h.headType === 'income' ? 'Income' : 'Expense'} head "${h.name}" deleted`)
    if (editing === h.id) reset()
  }

  const compose = composeOpt ?? list.length === 0

  return (
    <div className="page hd">
      <CpHero
        className="hd-hero"
        icon={Layers}
        eyebrow={isSuper ? 'Super Admin · Default for all chapters' : `${chapter?.name ?? ''} · ${member?.designation ?? ''}`}
        title="Income & Expense Heads"
        sub={isSuper ? 'The heads every chapter gets, including chapters added later. Chapters can add their own on top.' : 'Master income and expense heads for chapter transactions and reports. Defaults from the super admin are locked.'}
        back={isSuper ? undefined : { to: '/accounts', label: 'Accounts' }}
      >
        <div className="cx-side">
          <Nums
            items={[
              [incomes.length, 'income'],
              [expenses.length, 'expense'],
              [list.filter((h) => h.isActive).length, 'active'],
            ]}
          />
          <NewButton open={compose} label="New head" controls="hd-fold" onClick={() => (compose ? reset() : setComposeOpt(true))} />
        </div>
      </CpHero>

      <Fold id="hd-fold" open={compose} label="Account head form">
        <form className={`cp-form cp-form--stack hd-form hd-form--${headType}`} onSubmit={submit} noValidate>
          <h2 className="cp-form__h">
            {editing ? <Pencil size={17} /> : <Plus size={17} />} {editing ? 'Edit account head' : 'New account head'}
            <small>{isSuper ? 'All chapters' : chapter?.name}</small>
          </h2>
          <div className="cp-wide">
            <FieldGroup label="Head Type" required>
              <div className="hd-kind">
                <button type="button" className={`hd-kind__in${headType === 'income' ? ' is-on' : ''}`} aria-pressed={headType === 'income'} onClick={() => setHeadType('income')}>
                  <ArrowDownLeft size={20} />
                  <span>
                    <b>Income Head</b>
                    <small>Funds coming in</small>
                  </span>
                </button>
                <button type="button" className={`hd-kind__out${headType === 'expense' ? ' is-on' : ''}`} aria-pressed={headType === 'expense'} onClick={() => setHeadType('expense')}>
                  <ArrowUpRight size={20} />
                  <span>
                    <b>Expense Head</b>
                    <small>Funds going out</small>
                  </span>
                </button>
              </div>
            </FieldGroup>
          </div>

          <Field label={headType === 'income' ? 'Income Name' : 'Expense Name'} required error={errors.name}>
            <input className="field__control" value={name} onChange={(e) => setName(e.target.value)} placeholder={headType === 'income' ? 'e.g. Visitor Fee, Sponsorship, Fine' : 'e.g. Meeting Venue, Breakfast, Awards'} />
          </Field>

          <FieldGroup label="Status">
            <label className="cp-switch">
              <Toggle checked={isActive} onChange={setIsActive} label="Active status" />
              <span>{isActive ? 'Active' : 'Deactive'}</span>
            </label>
          </FieldGroup>

          <div className="cp-wide">
            <Field label="Comment (optional)">
              <textarea className="field__control" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional notes or description about this head" rows={2} />
            </Field>
          </div>

          {errors.form && <div className="form-error cp-wide">{errors.form}</div>}
          <div className="cp-form__foot">
            {editing && (
              <button className="cp-btn cp-btn--ghost" type="button" onClick={reset}>
                Cancel
              </button>
            )}
            <button className="cp-btn" type="submit">
              {editing ? <Pencil size={16} /> : <Plus size={16} />} {editing ? 'Update Head' : 'Save Head'}
            </button>
          </div>
        </form>
      </Fold>

      <div className="hd-bar">
        <div className="cp-tabs" role="tablist" aria-label="Kind of head">
          {(
            [
              ['all', 'All', list.length],
              ['income', 'Income', incomes.length],
              ['expense', 'Expense', expenses.length],
            ] as const
          ).map(([id, label, n]) => (
            <button key={id} type="button" role="tab" aria-selected={typeFilter === id} className={typeFilter === id ? 'is-on' : ''} onClick={() => setTypeFilter(id)}>
              {label}
              <i>{n}</i>
            </button>
          ))}
        </div>
        <ListSearch value={q} onChange={setQ} placeholder="Search heads by name or comment" />
      </div>
      {q && filtered.length === 0 && list.length > 0 && <NoMatch query={q} />}

      {list.length === 0 ? (
        <div className="cp-empty">
          <Layers size={30} />
          <b>No account heads yet</b>
          <span>{isSuper ? 'Set up the heads every chapter gets with the button above.' : "Set up your chapter's income and expense heads with the button above."}</span>
        </div>
      ) : (
        <>
          <ul className="hd-grid">
            {paginated.map((h) => {
              const isIncome = h.headType === 'income'
              const locked = !isSuper && !h.chapterId
              return (
                <li key={h.id} className={`hd-card hd-card--${isIncome ? 'in' : 'out'}${h.isActive ? '' : ' is-off'}${editing === h.id ? ' is-editing' : ''}`}>
                  <span className="hd-card__ico">{isIncome ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span>
                  <div className="hd-card__txt">
                    <b>{h.name}</b>
                    <span>{h.comment || 'No comment'}</span>
                    <div className="hd-card__tags">
                      <em>{isIncome ? 'Income' : 'Expense'}</em>
                      {locked && <em className="is-mute">Default</em>}
                      {!h.isActive && <em className="is-bad">Deactive</em>}
                    </div>
                  </div>
                  <div className="cp-acts cp-acts--col">
                    {locked ? (
                      <button type="button" className="cp-act cp-act--icon" disabled title="Default set by the super admin. It cannot be changed here." aria-label="Locked">
                        <Lock size={14} />
                      </button>
                    ) : (
                      <>
                        <button type="button" className="cp-act cp-act--icon" title="Edit head" aria-label={`Edit ${h.name}`} onClick={() => startEdit(h)}>
                          <Pencil size={14} />
                        </button>
                        <button type="button" className="cp-act cp-act--icon cp-act--danger" title="Delete head" aria-label={`Delete ${h.name}`} onClick={() => remove(h)}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {totalPages > 1 && (
            <div className="cp-pager">
              <span>
                Showing <b>{(page - 1) * pageSize + 1}</b>–<b>{Math.min(page * pageSize, filtered.length)}</b> of <b>{filtered.length}</b> heads
              </span>
              <div>
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft size={16} /> Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                  <button key={num} type="button" className={num === page ? 'is-on' : ''} aria-current={num === page ? 'page' : undefined} onClick={() => setPage(num)}>
                    {num}
                  </button>
                ))}
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
