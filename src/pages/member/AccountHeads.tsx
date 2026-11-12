import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, Layers, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { Field, FieldGroup, Glyph, PageHead, Sheet, StatStrip, Toggle } from '../../components/ui'
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
  }

  function startEdit(h: AccountHead) {
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

  return (
    <div className="page">
      <PageHead
        eyebrow={isSuper ? 'Super Admin · Default for all chapters' : `${chapter?.name ?? ''} · ${member?.designation ?? ''}`}
        icon={Layers}
        tone="steel"
        title="Income & Expense Heads"
        subtitle={isSuper ? 'The income and expense heads every chapter gets, including chapters added later. Chapters can add their own on top.' : 'Manage master income and expense heads for chapter transactions and reports. Defaults from the super admin are locked.'}
        actions={
          isSuper ? undefined : (
            <Link className="btn btn--line btn--sm" to="/accounts">
              <ArrowLeft size={16} /> Accounts
            </Link>
          )
        }
      />

      <StatStrip
        items={[
          { icon: ArrowDownLeft, tone: 'green', label: 'Income Heads', value: incomes.length },
          { icon: ArrowUpRight, tone: 'red', label: 'Expense Heads', value: expenses.length },
          { icon: CheckCircle2, tone: 'steel', label: 'Active Heads', value: list.filter((h) => h.isActive).length },
        ]}
      />

      <div className="att">
        <Sheet
          icon={editing ? Pencil : Plus}
          tone={headType === 'income' ? 'green' : 'red'}
          title={editing ? 'Edit account head' : 'New account head'}
          note={isSuper ? 'All chapters' : chapter?.name}
        >
          <form className="form-stack" onSubmit={submit} noValidate>
            <FieldGroup label="Head Type" required>
              <div className="kind">
                <button
                  type="button"
                  className={`kind__opt kind__opt--income ${headType === 'income' ? 'is-on' : ''}`}
                  aria-pressed={headType === 'income'}
                  onClick={() => setHeadType('income')}
                >
                  <ArrowDownLeft size={20} style={{ color: '#16a34a' }} />
                  <span>
                    <b>Income Head</b>
                    <small>Funds coming in</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={`kind__opt ${headType === 'expense' ? 'is-on' : ''}`}
                  aria-pressed={headType === 'expense'}
                  onClick={() => setHeadType('expense')}
                >
                  <ArrowUpRight size={20} style={{ color: '#dc2626' }} />
                  <span>
                    <b>Expense Head</b>
                    <small>Funds going out</small>
                  </span>
                </button>
              </div>
            </FieldGroup>

            <Field label={headType === 'income' ? 'Income Name' : 'Expense Name'} required error={errors.name}>
              <input
                className="field__control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={headType === 'income' ? 'e.g. Visitor Fee, Sponsorship, Fine' : 'e.g. Meeting Venue, Breakfast, Awards'}
              />
            </Field>

            <Field label="Comment (optional)">
              <textarea
                className="field__control"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional notes or description about this head"
                rows={3}
              />
            </Field>

            <FieldGroup label="Status">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <Toggle checked={isActive} onChange={setIsActive} label="Active status" />
                <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                  {isActive ? 'Active' : 'Deactive'}
                </span>
              </label>
            </FieldGroup>

            {errors.form && <div className="form-error">{errors.form}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn--primary" type="submit">
                {editing ? <Pencil size={16} /> : <Plus size={16} />} {editing ? 'Update Head' : 'Save Head'}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="list__title" style={{ margin: 0 }}>
              Account heads <span>{list.length}</span>
            </h2>
            <div className="seg" role="group" style={{ margin: 0 }}>
              <button type="button" aria-pressed={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
                All ({list.length})
              </button>
              <button type="button" aria-pressed={typeFilter === 'income'} onClick={() => setTypeFilter('income')}>
                Income ({incomes.length})
              </button>
              <button type="button" aria-pressed={typeFilter === 'expense'} onClick={() => setTypeFilter('expense')}>
                Expense ({expenses.length})
              </button>
            </div>
          </div>

          <ListSearch value={q} onChange={setQ} placeholder="Search heads by name or comment" />
          {q && filtered.length === 0 && list.length > 0 && <NoMatch query={q} />}

          {list.length === 0 ? (
            <div className="empty">
              <b>No account heads yet.</b>
              {isSuper ? 'Use the form on the left to set up the heads every chapter gets.' : "Use the form on the left to set up your chapter's income and expense heads."}
            </div>
          ) : (
            <>
              {paginated.map((h) => {
                const isIncome = h.headType === 'income'
                const locked = !isSuper && !h.chapterId
                return (
                  <article key={h.id} className="row" style={{ opacity: h.isActive ? 1 : 0.7 }}>
                    <div className="row__acts">
                      {locked ? (
                        <button type="button" className="btn btn--ghost btn--sm" disabled title="Default set by the super admin. It cannot be changed here." style={{ padding: '6px 8px', color: 'var(--ink-mute)', opacity: 0.45, cursor: 'not-allowed' }}>
                          <Lock size={14} />
                        </button>
                      ) : (
                        <>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        title="Edit head"
                        aria-label={`Edit ${h.name}`}
                        onClick={() => startEdit(h)}
                        style={{ padding: '6px 8px' }}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        title="Delete head"
                        aria-label={`Delete ${h.name}`}
                        onClick={() => remove(h)}
                        style={{ padding: '6px 8px', color: '#ef4444' }}
                      >
                        <Trash2 size={15} />
                      </button>
                        </>
                      )}
                    </div>
                    <Glyph icon={isIncome ? ArrowDownLeft : ArrowUpRight} tone={isIncome ? 'green' : 'red'} size={50} />
                    <div className="row__main">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <b>{h.name}</b>
                        <span className={`headkind ${isIncome ? 'headkind--income' : 'headkind--expense'}`}>
                          {isIncome ? 'Income' : 'Expense'}
                        </span>
                        {locked && <span className="chip">Default</span>}
                        {!h.isActive && <span className="stat stat--bad">Deactive</span>}
                      </div>
                      <span>{h.comment || 'No comment'}</span>
                    </div>
                  </article>
                )
              })}

              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    marginTop: 8,
                    borderRadius: 'var(--radius)',
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--line)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: '0.86rem', color: 'var(--ink-mute)' }}>
                    Showing <b>{(page - 1) * pageSize + 1}</b>–<b>{Math.min(page * pageSize, filtered.length)}</b> of <b>{filtered.length}</b> heads
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      style={{
                        padding: '6px 10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        opacity: page <= 1 ? 0.45 : 1,
                        cursor: page <= 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ChevronLeft size={16} /> Prev
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => {
                        const isCurrent = num === page
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setPage(num)}
                            style={{
                              minWidth: 32,
                              height: 32,
                              padding: '0 8px',
                              borderRadius: 'var(--radius-sm, 6px)',
                              border: isCurrent ? '1px solid var(--brand)' : '1px solid var(--line)',
                              background: isCurrent ? 'var(--brand)' : 'transparent',
                              color: isCurrent ? '#fff' : 'var(--ink)',
                              fontWeight: isCurrent ? 700 : 500,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {num}
                          </button>
                        )
                      })}
                    </div>

                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      style={{
                        padding: '6px 10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        opacity: page >= totalPages ? 0.45 : 1,
                        cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
