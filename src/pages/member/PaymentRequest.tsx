import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, CalendarOff, ChevronDown, Download, Pencil, Repeat, Save, Search, SendHorizontal, Trash2, Users } from 'lucide-react'
import CpHero, { Nums } from '../../components/CpHero'
import HeadSelect from '../../components/HeadSelect'
import { Avatar, Field, FieldGroup } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { headsOf } from '../../lib/heads'
import { addMonths, dayOf } from '../../lib/dues'
import { fmtDate, inr } from '../../lib/format'
import { downloadInvoice, invoiceNo } from '../../lib/invoicePdf'
import { useNow } from '../../lib/hooks'
import { MAX_OCCURRENCES, RECURRENCE_LABEL, recurrenceDates } from '../../lib/recurrence'
import { useConfirm } from '../../lib/confirm'
import { createPaymentRequest, deletePaymentRequest, updatePaymentRequest, useDB } from '../../lib/store'
import { useToast } from '../../lib/toast'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import type { PaymentRequest as RequestRecord, Recurrence } from '../../lib/types'

export default function PaymentRequest() {
  const { member, chapter } = useAuth()
  const db = useDB()
  const [reqQuery, setReqQuery] = useState('')
  const [sending, setSending] = useState(false)
  const toast = useToast()
  const confirm = useConfirm()
  const now = useNow(60_000)

  const [typeId, setTypeId] = useState('')
  const [amount, setAmount] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [description, setDescription] = useState('')
  const [hasDue, setHasDue] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [every, setEvery] = useState<Recurrence>('monthly')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  /* The end date starts 6 months after the start date until someone types their own. */
  const [toEdited, setToEdited] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string[]>([])
  /* the request being edited, or null while a new one is written */
  const [editing, setEditing] = useState<string | null>(null)
  const formTop = useRef<HTMLDivElement>(null)

  if (!member || !chapter) return null
  const chapterId = chapter.id
  /* What can be asked for is the chapter's active income heads (Manage Payments > Income / Expense Heads): money members pay in. */
  const types = headsOf(db, chapter.id)
    .filter((h) => h.isActive && h.headType === 'income')
    .sort((a, b) => a.name.localeCompare(b.name))
  const requests = db.requests.filter((r) => r.chapterId === chapter.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const today = dayOf(now)
  const editingReq = editing ? requests.find((r) => r.id === editing) : undefined
  const editingRecurring = Boolean(editingReq?.recurrence)
  /* members whose payment on the request has been verified stay on it; the others can be taken off */
  const lockedStatus = new Map<string, 'paid'>()
  if (editingReq) {
    for (const i of db.invoices) {
      if (i.requestId === editingReq.id && i.memberId && i.status === 'paid') lockedStatus.set(i.memberId, 'paid')
    }
  }
  const shownRequests = requests.filter((r) => matches(reqQuery, r.typeName, r.description, r.amount, r.recurrence?.every))

  const chapterMembers = db.members.filter((m) => m.chapterId === chapterId && m.loginEnabled !== false).sort((a, b) => a.name.localeCompare(b.name))
  const q = query.trim().toLowerCase()
  const shown = q ? chapterMembers.filter((m) => `${m.name} ${m.mobile} ${m.organisation} ${m.designation}`.toLowerCase().includes(q)) : chapterMembers
  /* A recurring request goes only to active members. */
  const canPick = (m: { id: string; isActive?: boolean }) => {
    if (lockedStatus.has(m.id)) return false
    if (editingRecurring) return m.isActive !== false || picked.includes(m.id)
    return !recurring || m.isActive !== false
  }
  const pickable = shown.filter(canPick)
  const allShownPicked = pickable.length > 0 && pickable.every((m) => picked.includes(m.id))

  function changeFrom(value: string) {
    setFrom(value)
    if (value && (!toEdited || !to || to < value)) {
      setTo(addMonths(value, 6))
      setToEdited(false)
    }
  }

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  function toggleAll() {
    const ids = pickable.map((m) => m.id)
    setPicked((cur) => (allShownPicked ? cur.filter((id) => !ids.includes(id)) : [...new Set([...cur, ...ids])]))
  }

  function clearForm() {
    setEditing(null)
    setPicked([])
    setQuery('')
    setDescription('')
    setHasDue(false)
    setDueDate('')
    setRecurring(false)
    setFrom('')
    setTo('')
    setToEdited(false)
    setTypeId('')
    setAmount('')
    setErrors({})
  }

  function startEdit(r: RequestRecord) {
    clearForm()
    setEditing(r.id)
    setTypeId(r.typeId)
    setAmount(String(r.amount))
    setDescription(r.description)
    setPicked(r.memberIds)
    setHasDue(Boolean(r.dueDate))
    setDueDate(r.dueDate)
    formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!chapter || sending) return
    const next: Record<string, string> = {}
    const money = Number(amount)
    if (!typeId) next.typeId = 'Select a request type.'
    if (!(money > 0)) next.amount = 'Enter the amount to collect.'
    if (picked.length === 0) next.members = 'Select at least one member.'
    if (editing) {
      /* the date a request already has may be in the past; only a changed date must not be */
      if (!editingRecurring && hasDue) {
        if (!dueDate) next.dueDate = 'Enter the due date.'
        else if (dueDate < today && dueDate !== editingReq?.dueDate) next.dueDate = 'The due date cannot be in the past.'
      }
    } else if (recurring) {
      if (!from) next.from = 'Choose the start date.'
      else if (from < today) next.from = 'The start date cannot be in the past.'
      if (!to) next.to = 'Choose the end date.'
      else if (from && to < from) next.to = 'The end date must be on or after the start date.'
      if (from && to && to >= from && recurrenceDates(every, from, to).length > MAX_OCCURRENCES) next.to = `That makes more than ${MAX_OCCURRENCES} dues. Choose a shorter period.`
    } else if (hasDue) {
      if (!dueDate) next.dueDate = 'Enter the due date.'
      else if (dueDate < today) next.dueDate = 'The due date cannot be in the past.'
    }
    setErrors(next)
    if (Object.keys(next).length) return

    if (editing) {
      setSending(true)
      const res = await updatePaymentRequest(editing, { typeId, amount: money, description, dueDate: hasDue ? dueDate : '', memberIds: picked, recurring: editingRecurring })
      setSending(false)
      if (res.error) return setErrors({ [res.field ?? 'form']: res.error })
      toast('Request updated')
      clearForm()
      return
    }

    const recipients = recurring ? picked.filter((id) => db.members.find((m) => m.id === id)?.isActive !== false) : picked
    setSending(true)
    const res = await createPaymentRequest({
      regionId: chapter.regionId,
      chapterId,
      typeId,
      amount: money,
      description,
      dueDate: !recurring && hasDue ? dueDate : '',
      memberIds: recipients,
      recurrence: recurring ? { every, from, to } : undefined,
    })
    setSending(false)
    if (res.error) return setErrors({ [res.field ?? 'form']: res.error })
    toast(
      recurring
        ? `${RECURRENCE_LABEL[every]} request scheduled: ${recurrenceDates(every, from, to).length} dues, each invoiced on its own date, for ${recipients.length} active ${recipients.length === 1 ? 'member' : 'members'}`
        : `Request sent to ${picked.length} ${picked.length === 1 ? 'member' : 'members'}`,
    )
    clearForm()
  }

  const askTotal = (Number(amount) || 0) * picked.length

  return (
    <div className="page pr">
      <CpHero className="pr-hero" icon={SendHorizontal} eyebrow={`${chapter.name} · ${member.designation}`} title="Payment Request" sub="Choose what you are asking for and who should pay. It appears in their Dues straight away; a recurring request adds each due on its date." back={{ to: '/payments', label: 'Manage Payments' }}>
        <Nums
          items={[
            [requests.length, 'requests'],
            [types.length, 'heads'],
            [chapterMembers.length, 'members'],
          ]}
        />
      </CpHero>

      <div ref={formTop} className="pr-anchor" />
      <form className="pr-form" onSubmit={submit} noValidate>
        {editing && (
          <div className="pr-editing">
            <Pencil size={16} /> Editing <b>{editingReq?.typeName ?? 'request'}</b> · {chapter.name}
          </div>
        )}

        {/* step 1: what */}
        <section className="pr-step">
          <span className="pr-step__n" aria-hidden>1</span>
          <div className="pr-step__body">
            <h2>What are you asking for?</h2>
            <div className="pr-grid">
              <Field label="Request type" required error={errors.typeId}>
                <HeadSelect value={typeId} onChange={setTypeId} placeholder="Select request type" options={types.map((t) => ({ id: t.id, name: t.name, kind: t.headType }))} />
              </Field>
              <Field label="Amount per member (₹)" required error={errors.amount}>
                <input className="field__control" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 500" />
              </Field>
              <div className="pr-wide">
                <Field label="Description (optional)">
                  <textarea className="field__control" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this payment for?" maxLength={300} />
                </Field>
              </div>
            </div>
            {types.length === 0 && (
              <p className="field__hint">
                No heads yet. Add one in <Link to="/payments/heads">Income / Expense Heads</Link> first.
              </p>
            )}
          </div>
        </section>

        {/* step 2: who */}
        <section className="pr-step">
          <span className="pr-step__n" aria-hidden>2</span>
          <div className="pr-step__body">
            <h2>Who should pay?</h2>
            <FieldGroup label="Select members" required error={errors.members}>
              {!chapterId ? (
                <p className="pick__empty">Choose a chapter to see its members.</p>
              ) : (
                <div className="pick">
                  <div className="pick__bar">
                    <label className="pick__search">
                      <Search size={16} />
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members" aria-label="Search members" />
                    </label>
                    <label className="check pick__all">
                      <input type="checkbox" checked={allShownPicked} onChange={toggleAll} /> Select all{q ? ` (${shown.length})` : ''}
                    </label>
                  </div>
                  <ul className="pick__list">
                    {shown.length === 0 && <li className="pick__none">No member matches “{query}”.</li>}
                    {shown.map((m) => (
                      <li key={m.id}>
                        <label className={`pick__row ${picked.includes(m.id) ? 'is-on' : ''}`} style={canPick(m) ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}>
                          <input type="checkbox" checked={picked.includes(m.id)} disabled={!canPick(m)} onChange={() => toggle(m.id)} />
                          <Avatar name={m.name} photo={m.photo} size={34} />
                          <span className="pick__who">
                            <b>{m.name}</b>
                            <small>{m.organisation || m.designation}</small>
                          </span>
                          {lockedStatus.has(m.id) && <span className="stat stat--ok">Paid</span>}
                          {m.isActive === false && <span className="stat stat--bad">Deactive</span>}
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="pick__count">
                    <Users size={14} /> {picked.length} of {chapterMembers.length} selected
                  </div>
                </div>
              )}
            </FieldGroup>
            {editing && lockedStatus.size > 0 && <p className="field__hint">A member whose payment has been verified stays on the request and keeps the amount they paid. Anyone else can be taken off; a payment still waiting to be verified is removed with them.</p>}
          </div>
        </section>

        {/* step 3: when */}
        <section className="pr-step">
          <span className="pr-step__n" aria-hidden>3</span>
          <div className="pr-step__body">
            <h2>When is it due?</h2>

            {!editing && (
              <FieldGroup label="Recurring">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={recurring}
                    onChange={(e) => {
                      setRecurring(e.target.checked)
                      if (e.target.checked) setPicked((cur) => cur.filter((id) => db.members.find((m) => m.id === id)?.isActive !== false))
                    }}
                  />{' '}
                  <Repeat size={14} /> Make this a recurring request
                </label>
              </FieldGroup>
            )}

            {editingRecurring && editingReq?.recurrence && (
              <p className="field__hint">
                <Repeat size={14} /> {RECURRENCE_LABEL[editingReq.recurrence.every]} request, {fmtDate(editingReq.recurrence.from)} to {fmtDate(editingReq.recurrence.to)}. Its dates cannot be changed; the type, amount, description and members can. Dues already created that are unpaid follow the changes.
              </p>
            )}

            {recurring && (
              <>
                <FieldGroup label="Repeat" required>
                  <div className="seg" role="group">
                    {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((k) => (
                      <button key={k} type="button" aria-pressed={every === k} onClick={() => setEvery(k)}>
                        {RECURRENCE_LABEL[k]}
                      </button>
                    ))}
                  </div>
                </FieldGroup>
                <div className="pr-grid">
                  <Field label="From date" required error={errors.from}>
                    <input className="field__control" type="date" min={today} value={from} onChange={(e) => changeFrom(e.target.value)} />
                  </Field>
                  <Field label="To date" required error={errors.to}>
                    <input
                      className="field__control"
                      type="date"
                      min={from || today}
                      value={to}
                      onChange={(e) => {
                        setTo(e.target.value)
                        setToEdited(true)
                      }}
                    />
                  </Field>
                </div>
                <p className="field__hint">
                  {from && to && to >= from
                    ? `${recurrenceDates(every, from, to).length} dues per member, one on each ${every === 'daily' ? 'day' : every === 'weekly' ? 'week' : 'month'} date from ${fmtDate(from)} to ${fmtDate(to)}. Each invoice is created on its date. Only active members are billed.`
                    : 'Each date in the period becomes a due, with that date as its due date. Its invoice is created on that date. Only active members are billed.'}
                </p>
              </>
            )}

            {!recurring && !editingRecurring && (
              <FieldGroup label="Due date" required>
                <div className="kind pr-kind">
                  <button type="button" className={`kind__opt ${hasDue ? 'is-on' : ''}`} aria-pressed={hasDue} onClick={() => setHasDue(true)}>
                    <CalendarCheck size={20} />
                    <span>
                      <b>Yes</b>
                      <small>Set a due date</small>
                    </span>
                  </button>
                  <button type="button" className={`kind__opt ${!hasDue ? 'is-on' : ''}`} aria-pressed={!hasDue} onClick={() => setHasDue(false)}>
                    <CalendarOff size={20} />
                    <span>
                      <b>No</b>
                      <small>No due date</small>
                    </span>
                  </button>
                </div>
              </FieldGroup>
            )}

            {!recurring && !editingRecurring && hasDue && (
              <Field label="Enter due date" required error={errors.dueDate}>
                <input className="field__control" type="date" min={editing ? undefined : today} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
            )}
          </div>
        </section>

        {errors.recurrence && <div className="form-error">{errors.recurrence}</div>}
        {errors.form && <div className="form-error">{errors.form}</div>}

        <div className="pr-send">
          <span className="pr-send__sum">
            <b>{askTotal > 0 ? inr(askTotal) : '₹0'}</b>
            <small>
              {picked.length} {picked.length === 1 ? 'member' : 'members'}
              {Number(amount) > 0 ? ` × ${inr(Number(amount))}` : ''}
            </small>
          </span>
          {editing && (
            <button className="cp-btn cp-btn--ghost" type="button" onClick={clearForm}>
              Cancel
            </button>
          )}
          <button className="cp-btn" type="submit" disabled={sending}>
            {editing ? <Save size={16} /> : <SendHorizontal size={16} />} {editing ? 'Save changes' : 'Save and send'}
          </button>
        </div>
      </form>

      <section className="pr-feed" aria-label="Sent requests">
        <h2 className="pr-feed__h">
          Sent requests <span>{requests.length}</span>
        </h2>
        <ListSearch value={reqQuery} onChange={setReqQuery} placeholder="Search requests" />
        {reqQuery && shownRequests.length === 0 && requests.length > 0 && <NoMatch query={reqQuery} />}
        {requests.length === 0 ? (
          <div className="cp-empty">
            <SendHorizontal size={30} />
            <b>No requests yet</b>
            <span>Requests you send will be listed here.</span>
          </div>
        ) : (
          <div className="pr-cards">
            {shownRequests.map((r) => {
              const sent = db.invoices.filter((i) => i.requestId === r.id)
              const done = sent.filter((i) => i.status === 'paid').length
              /* paid by the member, waiting for the chapter to verify it */
              const waiting = sent.filter((i) => i.status === 'pending').length
              const state = sent.length > 0 && done === sent.length ? 'ok' : waiting > 0 ? 'warn' : sent.some((i) => i.status === 'due') ? 'bad' : 'idle'
              const pct = sent.length ? Math.round(((done + waiting) / sent.length) * 100) : 0
              return (
                <article key={r.id} className={`pr-card pr-card--${state}${editing === r.id ? ' is-editing' : ''}`}>
                  <header>
                    <span className="pr-card__ico">
                      <SendHorizontal size={18} />
                    </span>
                    <div>
                      <b>{r.typeName}</b>
                      <small>
                        {db.chapters.find((c) => c.id === r.chapterId)?.name ?? 'Chapter'} · sent {fmtDate(r.createdAt)}
                      </small>
                    </div>
                    <strong>{inr(r.amount)}</strong>
                  </header>
                  <p className="pr-card__when">
                    {r.recurrence ? (
                      <em className="duepill">
                        {RECURRENCE_LABEL[r.recurrence.every]} · {fmtDate(r.recurrence.from)} to {fmtDate(r.recurrence.to)}
                      </em>
                    ) : r.dueDate ? (
                      <em className="duepill">Due {fmtDate(r.dueDate)}</em>
                    ) : (
                      <span>No due date</span>
                    )}
                    <span>{r.memberIds.length} members</span>
                  </p>
                  {r.description && <p className="pr-card__note">{r.description}</p>}
                  {r.recurrence && (
                    <p className="pr-card__note">
                      {new Set(sent.map((i) => i.dueDate)).size} of {r.recurrence.dates.length} dues created
                      {r.recurrence.dates.find((d) => d > today) ? ` · next invoice on ${fmtDate(r.recurrence.dates.find((d) => d > today) ?? '')}` : ' · all created'}
                    </p>
                  )}
                  <div className="pr-card__prog" aria-hidden>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <footer>
                    {/* green once all are verified, orange while a payment waits for verification, red while dues are unpaid */}
                    <span className={`stat stat--${state === 'idle' ? 'idle' : state}`}>
                      {done + waiting} of {sent.length} paid{waiting > 0 ? ` · ${waiting} to verify` : ''}
                    </span>
                    <div className="cp-acts">
                      <button type="button" className="cp-act cp-act--icon" aria-label="Edit request" title="Edit request" onClick={() => startEdit(r)}>
                        <Pencil size={14} />
                      </button>
                      {/* A request can be deleted only while no payment has been updated against it. */}
                      <button
                        type="button"
                        className="cp-act cp-act--icon cp-act--danger"
                        aria-label="Delete request"
                        disabled={sent.some((i) => i.status !== 'due')}
                        title={sent.some((i) => i.status !== 'due') ? 'A payment has been received, so this request cannot be deleted' : 'Delete request'}
                        onClick={async () => {
                          if (!(await confirm({ title: 'Delete request?', message: `${r.typeName} · ${inr(r.amount)} and its ${sent.length} ${sent.length === 1 ? 'invoice' : 'invoices'} will be removed. Members will no longer see these dues.` }))) return
                          const res = await deletePaymentRequest(r.id)
                          toast(res.error ?? 'Request deleted', res.error ? 'info' : undefined)
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </footer>
                  <button type="button" className="pr-card__toggle" aria-expanded={open.includes(r.id)} onClick={() => setOpen((cur) => (cur.includes(r.id) ? cur.filter((x) => x !== r.id) : [...cur, r.id]))}>
                    Invoice IDs ({sent.length}) <ChevronDown size={16} className={open.includes(r.id) ? 'is-up' : ''} />
                  </button>
                  {open.includes(r.id) && (
                    <ul className="reqinv">
                      {sent.map((i) => {
                        const who = db.members.find((m) => m.id === i.memberId)
                        return (
                          <li key={i.id}>
                            <b className="reqinv__no">{invoiceNo(i)}</b>
                            <span className="reqinv__who">{who?.name ?? 'Member'}</span>
                            <span className={`stat ${i.status === 'paid' ? 'stat--ok' : i.status === 'pending' ? 'stat--warn' : 'stat--bad'}`}>{i.status === 'paid' ? 'Paid' : i.status === 'pending' ? 'Verification pending' : 'Due'}</span>
                            <span className="reqinv__amt">{inr(i.amount)}</span>
                            {who && (
                              <button type="button" className="iconbtn" aria-label={`Download invoice ${invoiceNo(i)}`} onClick={() => downloadInvoice({ invoice: i, member: who, chapter, region: db.regions.find((x) => x.id === chapter.regionId) ?? null })}>
                                <Download size={15} />
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
