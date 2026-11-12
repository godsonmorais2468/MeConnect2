import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleCheck, CircleDot, ListChecks, Lock, Sparkles, SquareCheck } from 'lucide-react'
import PollPreview from '../../components/PollPreview'
import PollResults from '../../components/PollResults'
import { Glyph, PageHead } from '../../components/ui'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { useAuth } from '../../lib/auth'
import { matches } from '../../lib/search'
import { fmtDate } from '../../lib/format'
import { tally } from '../../lib/polls'
import { submitVote, useDB } from '../../lib/store'
import { useToast } from '../../lib/toast'
import type { Member, Poll } from '../../lib/types'

export default function Rsvp() {
  const { member } = useAuth()
  const db = useDB()
  const [q, setQ] = useState('')
  if (!member) return null

  const polls = db.polls.filter((p) => p.chapterId === member.chapterId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const answered = (p: Poll) => db.votes.some((v) => v.pollId === p.id && v.memberId === member.id)
  const shown = polls.filter((p) => matches(q, p.question, ...p.options.map((o) => o.text)))
  const waiting = polls.filter((p) => !p.closed && !answered(p)).length

  return (
    <div className="page">
      <PageHead
        eyebrow="Chapter polls"
        icon={ListChecks}
        tone="green"
        title="Polls"
        subtitle={waiting ? `${waiting} ${waiting === 1 ? 'poll is' : 'polls are'} waiting for your response.` : 'Answer polls from your region admin.'}
      />

      {polls.length === 0 ? (
        <div className="empty">
          <b>No polls yet.</b>
          Polls from your region admin will appear here.
        </div>
      ) : (
        <div className="att">
          <ListSearch value={q} onChange={setQ} placeholder="Search polls" />
          {q && shown.length === 0 && <NoMatch query={q} />}
          {shown.map((p) => (
            <PollForm key={p.id} poll={p} member={member} />
          ))}
        </div>
      )}
    </div>
  )
}

function PollForm({ poll, member }: { poll: Poll; member: Member }) {
  const db = useDB()
  const toast = useToast()
  const mine = db.votes.find((v) => v.pollId === poll.id && v.memberId === member.id)
  const [picked, setPicked] = useState<string[]>(mine?.optionIds ?? [])
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  /* the poll's picture and description, in a pop-up */
  const [about, setAbout] = useState(false)
  const hasAbout = Boolean(poll.image || poll.description)
  const { voters } = tally(poll, db.votes)

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

  return (
    <article className="pcard pcard--vote">
      <header className="pcard__head">
        <Glyph icon={poll.multiple ? SquareCheck : CircleDot} tone={poll.closed ? 'steel' : 'green'} size={46} />
        <div className="pcard__title">
          <b>{poll.question}</b>
          <span>
            {poll.multiple ? 'Choose all that apply' : 'Choose one'} · {fmtDate(poll.createdAt)}
          </span>
        </div>
        <span className={`stat ${poll.closed ? 'stat--idle' : mine ? 'stat--ok' : 'stat--bad'}`}>{poll.closed ? 'Closed' : mine ? 'Answered' : 'Needs answer'}</span>
        {hasAbout && (
          <button type="button" className="pollinfo" onClick={() => setAbout(true)} aria-label="About this poll: picture and description">
            <Sparkles size={16} /> View details
          </button>
        )}
      </header>
      {about && <PollPreview image={poll.image ?? ''} description={poll.description ?? ''} onClose={() => setAbout(false)} />}

      {showForm ? (
        <form onSubmit={submit} noValidate>
          <fieldset className="choices">
            <legend className="sr-only">{poll.question}</legend>
            {poll.options.map((o) => (
              <label key={o.id} className={`choice ${picked.includes(o.id) ? 'is-on' : ''}`}>
                <input type={poll.multiple ? 'checkbox' : 'radio'} name={`poll-${poll.id}`} checked={picked.includes(o.id)} onChange={() => choose(o.id)} />
                <span className={`choice__mark ${poll.multiple ? 'is-box' : ''}`} aria-hidden />
                <span>{o.text}</span>
              </label>
            ))}
          </fieldset>
          {error && <div className="form-error">{error}</div>}
          <div className="pcard__acts pcard__acts--start">
            <button className="btn btn--primary btn--sm" type="submit">
              <CircleCheck size={15} /> {mine ? 'Update response' : 'Submit response'}
            </button>
            {editing && (
              <button
                className="btn btn--line btn--sm"
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
          </div>
        </form>
      ) : (
        <>
          <PollResults poll={poll} votes={db.votes} mine={mine?.optionIds} />
          <footer className="pcard__foot">
            <span className="pcard__count">
              {poll.closed && !mine && (
                <>
                  <Lock size={15} /> Closed without your response ·{' '}
                </>
              )}
              {voters} {voters === 1 ? 'member has' : 'members have'} responded
            </span>
            {!poll.closed && mine && (
              <button className="btn btn--line btn--sm" onClick={() => setEditing(true)}>
                Change my response
              </button>
            )}
          </footer>
        </>
      )}
    </article>
  )
}
