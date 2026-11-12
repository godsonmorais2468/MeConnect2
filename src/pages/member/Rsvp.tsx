import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check, CircleCheck, Lock, Sparkles, Vote as VoteIcon } from 'lucide-react'
import PollPreview from '../../components/PollPreview'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { useAuth } from '../../lib/auth'
import { matches } from '../../lib/search'
import { fmtDate } from '../../lib/format'
import { tally } from '../../lib/polls'
import { submitVote, useDB } from '../../lib/store'
import { useToast } from '../../lib/toast'
import type { Member, Poll } from '../../lib/types'

type Tab = 'all' | 'todo' | 'done' | 'closed'

const letter = (i: number) => String.fromCharCode(65 + (i % 26))

/** A thin progress ring: how many of the open polls you have answered. */
function Ring({ done, total }: { done: number; total: number }) {
  const size = 96
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = total ? done / total : 1
  return (
    <span className="pl-ring" role="img" aria-label={total ? `${done} of ${total} open polls answered` : 'No open polls'}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" className="pl-ring__bg" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeLinecap="round" className="pl-ring__fg" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="pl-ring__txt">
        <b>{total ? `${done}/${total}` : '✓'}</b>
        <small>{total ? 'answered' : 'all clear'}</small>
      </span>
    </span>
  )
}

export default function Rsvp() {
  const { member } = useAuth()
  const db = useDB()
  const [q, setQ] = useState('')
  const [tabPick, setTabPick] = useState<Tab | null>(null)
  if (!member) return null

  const polls = db.polls.filter((p) => p.chapterId === member.chapterId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const answered = (p: Poll) => db.votes.some((v) => v.pollId === p.id && v.memberId === member.id)
  const statusOf = (p: Poll): Exclude<Tab, 'all'> => (p.closed ? 'closed' : answered(p) ? 'done' : 'todo')

  const counts = { all: polls.length, todo: 0, done: 0, closed: 0 }
  for (const p of polls) counts[statusOf(p)] += 1
  const open = counts.todo + counts.done
  /* the tab you have not picked yourself: what needs answering, or everything when nothing does */
  const tab: Tab = tabPick ?? (counts.todo ? 'todo' : 'all')

  const shown = polls.filter((p) => matches(q, p.question, ...p.options.map((o) => o.text)))
  const list = shown.filter((p) => tab === 'all' || statusOf(p) === tab)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'todo', label: 'To answer' },
    { id: 'done', label: 'Answered' },
    { id: 'closed', label: 'Closed' },
  ]

  return (
    <div className="page pl">
      <header className="pl-hero">
        <div className="pl-hero__text">
          <span className="pl-hero__icon">
            <VoteIcon size={24} />
          </span>
          <p className="pl-hero__eyebrow">Chapter polls</p>
          <h1>Polls</h1>
          <p className="pl-hero__sub">{counts.todo ? `${counts.todo} ${counts.todo === 1 ? 'poll is' : 'polls are'} waiting for your response.` : 'Answer polls from your region admin.'}</p>
        </div>
        <Ring done={counts.done} total={open} />
      </header>

      {polls.length === 0 ? (
        <div className="pl-empty">
          <VoteIcon size={30} />
          <b>No polls yet</b>
          <span>Polls from your region admin will appear here.</span>
        </div>
      ) : (
        <>
          <div className="pl-tabs" role="tablist" aria-label="Show polls">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTabPick(t.id)}>
                {t.label}
                <i>{counts[t.id]}</i>
              </button>
            ))}
          </div>

          <ListSearch value={q} onChange={setQ} placeholder="Search polls" />
          {q && shown.length === 0 && <NoMatch query={q} />}

          {!(q && shown.length === 0) && list.length === 0 && (
            <div className="pl-empty pl-empty--soft">
              <CircleCheck size={28} />
              <b>{tab === 'todo' ? 'You are all caught up' : 'Nothing here'}</b>
              <span>{tab === 'todo' ? 'Every open poll has your response.' : 'No polls in this view.'}</span>
            </div>
          )}

          <div className="pl-list">
            {list.map((p) => (
              <PollForm key={p.id} poll={p} member={member} status={statusOf(p)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const STATUS = {
  todo: { label: 'Needs answer', cls: 'todo' },
  done: { label: 'Answered', cls: 'done' },
  closed: { label: 'Closed', cls: 'closed' },
} as const

function PollForm({ poll, member, status }: { poll: Poll; member: Member; status: Exclude<Tab, 'all'> }) {
  const db = useDB()
  const toast = useToast()
  const mine = db.votes.find((v) => v.pollId === poll.id && v.memberId === member.id)
  const [picked, setPicked] = useState<string[]>(mine?.optionIds ?? [])
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  /* the poll's picture and description, in a pop-up */
  const [about, setAbout] = useState(false)
  const hasAbout = Boolean(poll.image || poll.description)
  const { counts, voters } = tally(poll, db.votes)
  const top = Math.max(0, ...poll.options.map((o) => counts[o.id] ?? 0))

  function choose(id: string) {
    setError('')
    setPicked((cur) => (poll.multiple ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id]))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const res = await submitVote(member.id, poll.id, picked)
    if (res.error) return setError(res.error)
    setEditing(false)
    toast(mine ? 'Response updated' : 'Response submitted')
  }

  const showForm = !poll.closed && (!mine || editing)
  const st = STATUS[status]

  return (
    <article className={`pl-card pl-card--${st.cls}`}>
      <header className="pl-card__head">
        <div className="pl-card__tags">
          <span className={`pl-tag pl-tag--${st.cls}`}>{st.label}</span>
          <span className="pl-tag">{poll.multiple ? 'Choose all that apply' : 'Choose one'}</span>
          <span className="pl-tag pl-tag--date">{fmtDate(poll.createdAt)}</span>
        </div>
        <h2>{poll.question}</h2>
        {hasAbout && (
          <button type="button" className="pl-card__info" onClick={() => setAbout(true)} aria-label="About this poll: picture and description">
            <Sparkles size={15} /> View details
          </button>
        )}
      </header>
      {about && <PollPreview image={poll.image ?? ''} description={poll.description ?? ''} onClose={() => setAbout(false)} />}

      {showForm ? (
        <form onSubmit={submit} noValidate>
          <fieldset className="pl-opts">
            <legend className="sr-only">{poll.question}</legend>
            {poll.options.map((o, i) => (
              <label key={o.id} className={`pl-opt${picked.includes(o.id) ? ' is-on' : ''}${poll.multiple ? ' is-box' : ''}`}>
                <input type={poll.multiple ? 'checkbox' : 'radio'} name={`poll-${poll.id}`} checked={picked.includes(o.id)} onChange={() => choose(o.id)} />
                <i className="pl-opt__key">{letter(i)}</i>
                <span className="pl-opt__text">{o.text}</span>
                <span className="pl-opt__tick" aria-hidden>
                  <Check size={15} strokeWidth={3} />
                </span>
              </label>
            ))}
          </fieldset>
          {error && <div className="form-error">{error}</div>}
          <div className="pl-bar">
            <span className="pl-bar__hint">{picked.length ? `${picked.length} selected` : poll.multiple ? 'Pick one or more' : 'Pick one'}</span>
            {editing && (
              <button
                className="pl-btn pl-btn--ghost"
                type="button"
                onClick={() => {
                  setEditing(false)
                  setPicked(mine?.optionIds ?? [])
                  setError('')
                }}
              >
                Cancel
              </button>
            )}
            <button className="pl-btn" type="submit">
              <CircleCheck size={16} /> {mine ? 'Update response' : 'Submit response'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <ul className="pl-res">
            {poll.options.map((o, i) => {
              const n = counts[o.id] ?? 0
              const pct = voters ? Math.round((n / voters) * 100) : 0
              const isMine = mine?.optionIds.includes(o.id)
              return (
                <li key={o.id} className={`${isMine ? 'is-mine' : ''}${n > 0 && n === top ? ' is-top' : ''}`}>
                  <div className="pl-res__row">
                    <i className="pl-res__key">{letter(i)}</i>
                    <span className="pl-res__text">
                      {o.text}
                      {isMine && (
                        <em>
                          <Check size={12} strokeWidth={3} /> Your answer
                        </em>
                      )}
                    </span>
                    <b>{pct}%</b>
                  </div>
                  <div className="pl-res__track">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <small>
                    {n} {n === 1 ? 'vote' : 'votes'}
                  </small>
                </li>
              )
            })}
          </ul>
          <footer className="pl-foot">
            <span>
              {poll.closed && !mine && (
                <>
                  <Lock size={14} /> Closed without your response ·{' '}
                </>
              )}
              {voters} {voters === 1 ? 'member has' : 'members have'} responded
            </span>
            {!poll.closed && mine && (
              <button className="pl-btn pl-btn--ghost" onClick={() => setEditing(true)}>
                Change my response
              </button>
            )}
          </footer>
        </>
      )}
    </article>
  )
}
