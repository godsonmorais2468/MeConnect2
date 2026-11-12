import { useState } from 'react'
import type { FormEvent } from 'react'
import { BarChart3, CircleDot, Eye, ListChecks, Lock, LockOpen, PenLine, Plus, SquareCheck, Trash2, Users, X } from 'lucide-react'
import CpHero from '../../components/CpHero'
import PollPreview from '../../components/PollPreview'
import PollResults from '../../components/PollResults'
import { Field, FieldGroup, PhotoField } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { fmtDate } from '../../lib/format'
import { tally } from '../../lib/polls'
import { createPoll, deletePoll, setPollClosed, useDB } from '../../lib/store'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import type { Poll } from '../../lib/types'

const MAX_OPTIONS = 10
const letter = (i: number) => String.fromCharCode(65 + (i % 26))

type Tab = 'polls' | 'new'

/** Polls (head table): a builder with a live preview of what members will see, and the polls as result cards. */
export default function Rsvp() {
  const { region, chapter: myChapter } = useAuth()
  const db = useDB()
  const [q, setQ] = useState('')
  const toast = useToast()

  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [multiple, setMultiple] = useState(false)
  const [options, setOptions] = useState(['', ''])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [openWho, setOpenWho] = useState<string[]>([])
  const [tabPick, setTabPick] = useState<Tab | null>(null)

  if (!region || !myChapter) return null
  const polls = db.polls.filter((p) => p.chapterId === myChapter.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const shown = polls.filter((p) => matches(q, p.question, ...p.options.map((o) => o.text)))
  const answers = polls.reduce((n, p) => n + tally(p, db.votes).voters, 0)
  const openCount = polls.filter((p) => !p.closed).length
  /* with no polls yet, the builder is the page */
  const tab: Tab = tabPick ?? (polls.length ? 'polls' : 'new')

  const setOption = (i: number, text: string) => setOptions((o) => o.map((x, k) => (k === i ? text : x)))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!region || !myChapter) return
    const next: Record<string, string> = {}
    const texts = options.map((o) => o.trim()).filter(Boolean)
    if (!question.trim()) next.question = 'Enter the poll name or question.'
    if (texts.length < 2) next.options = 'Add at least two answer options.'
    else if (new Set(texts.map((t) => t.toLowerCase())).size !== texts.length) next.options = 'Each option must be different.'
    setErrors(next)
    if (Object.keys(next).length) return

    const res = await createPoll({ regionId: region.id, chapterId: myChapter.id, question, description, image, multiple, options: texts })
    if (res.error) return setErrors({ form: res.error })
    toast('Poll created')
    setQuestion('')
    setDescription('')
    setImage('')
    setOptions(['', ''])
    setTabPick('polls')
  }

  function toggleWho(id: string) {
    setOpenWho((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  return (
    <div className="page pq">
      <CpHero className="pq-hero" icon={ListChecks} eyebrow={`${myChapter.name} · Head Table`} title="Polls" sub="Ask your chapter a question. Radio buttons for one answer, checkboxes when members can pick several.">
        <div className="pq-hero__nums">
          <span>
            <b>{polls.length}</b>
            <small>polls</small>
          </span>
          <span>
            <b>{openCount}</b>
            <small>open</small>
          </span>
          <span>
            <b>{answers}</b>
            <small>responses</small>
          </span>
        </div>
      </CpHero>

      <div className="pq-tabs" role="tablist" aria-label="Polls">
        <button type="button" role="tab" aria-selected={tab === 'polls'} className={tab === 'polls' ? 'is-on' : ''} onClick={() => setTabPick('polls')}>
          <BarChart3 size={16} /> All polls <i>{polls.length}</i>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'new'} className={tab === 'new' ? 'is-on' : ''} onClick={() => setTabPick('new')}>
          <PenLine size={16} /> Create poll
        </button>
      </div>

      {tab === 'new' && (
        <div className="pq-build">
          <form className="pq-form" onSubmit={submit} noValidate>
            <Field label="Poll name or question" required error={errors.question}>
              <input className="field__control" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Will you attend the Annual Day?" />
            </Field>

            <Field label="Description (optional)">
              <textarea className="field__control field__control--scroll" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell members more about this poll" />
            </Field>

            <PhotoField label="Image (optional)" value={image} onChange={setImage} edge={1280} />

            <FieldGroup label="Answer type" required>
              <div className="pq-kind">
                <button type="button" className={!multiple ? 'is-on' : ''} aria-pressed={!multiple} onClick={() => setMultiple(false)}>
                  <CircleDot size={20} />
                  <span>
                    <b>Radio button</b>
                    <small>Members choose any one</small>
                  </span>
                </button>
                <button type="button" className={multiple ? 'is-on' : ''} aria-pressed={multiple} onClick={() => setMultiple(true)}>
                  <SquareCheck size={20} />
                  <span>
                    <b>Checkbox</b>
                    <small>Members choose several</small>
                  </span>
                </button>
              </div>
            </FieldGroup>

            <FieldGroup label="Answer options" required error={errors.options}>
              <ul className="pq-opts">
                {options.map((text, i) => (
                  <li key={i}>
                    <i className={multiple ? 'is-box' : ''} aria-hidden>
                      {letter(i)}
                    </i>
                    <input className="field__control" value={text} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`} />
                    <button type="button" className="pq-x" disabled={options.length <= 2} onClick={() => setOptions((o) => o.filter((_, k) => k !== i))} aria-label={`Remove option ${i + 1}`}>
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              <div>
                <button type="button" className="pq-add" disabled={options.length >= MAX_OPTIONS} onClick={() => setOptions((o) => [...o, ''])}>
                  <Plus size={15} /> Add option
                </button>
              </div>
            </FieldGroup>

            {errors.form && <div className="form-error">{errors.form}</div>}
            <div className="pq-form__foot">
              <button className="pq-btn" type="submit">
                <Plus size={16} /> Publish poll
              </button>
              <button className="pq-btn pq-btn--ghost" type="button" onClick={() => setPreviewing(true)}>
                <Eye size={16} /> Picture and description
              </button>
            </div>
          </form>
          {previewing && <PollPreview image={image} description={description} onClose={() => setPreviewing(false)} />}

          {/* what members will see, as it is typed */}
          <aside className="pq-live" aria-label="Preview">
            <p className="pq-live__label">
              <Eye size={14} /> Live preview · what members see
            </p>
            <div className="pl-card pl-card--todo">
              <div className="pl-card__tags">
                <span className="pl-tag pl-tag--todo">Needs answer</span>
                <span className="pl-tag">{multiple ? 'Choose all that apply' : 'Choose one'}</span>
              </div>
              <h2 className="pq-live__q">{question.trim() || 'Your question appears here'}</h2>
              <div className="pl-opts">
                {options.map((text, i) => (
                  <div key={i} className={`pl-opt${multiple ? ' is-box' : ''}`}>
                    <i className="pl-opt__key">{letter(i)}</i>
                    <span className="pl-opt__text">{text.trim() || `Option ${i + 1}`}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {tab === 'polls' && (
        <>
          <ListSearch value={q} onChange={setQ} placeholder="Search polls" />
          {q && shown.length === 0 && polls.length > 0 && <NoMatch query={q} />}
          {polls.length === 0 ? (
            <div className="pq-empty">
              <ListChecks size={30} />
              <b>No polls yet</b>
              <span>Create the first one and members will see it on their Polls page.</span>
            </div>
          ) : (
            <div className="pq-list">
              {shown.map((p) => (
                <PollCard
                  key={p.id}
                  poll={p}
                  chapterName={db.chapters.find((c) => c.id === p.chapterId)?.name ?? 'Chapter'}
                  total={db.members.filter((m) => m.chapterId === p.chapterId && m.loginEnabled !== false).length}
                  who={openWho.includes(p.id)}
                  onWho={() => toggleWho(p.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PollCard({ poll, chapterName, total, who, onWho }: { poll: Poll; chapterName: string; total: number; who: boolean; onWho: () => void }) {
  const db = useDB()
  const toast = useToast()
  const confirm = useConfirm()
  const { voters } = tally(poll, db.votes)
  const pct = total ? Math.min(100, Math.round((voters / total) * 100)) : 0
  return (
    <article className={`pq-card${poll.closed ? ' is-closed' : ''}`}>
      <header className="pq-card__head">
        <span className="pq-card__ico">{poll.multiple ? <SquareCheck size={20} /> : <CircleDot size={20} />}</span>
        <div className="pq-card__title">
          <h3>{poll.question}</h3>
          <span>
            {chapterName} · created {fmtDate(poll.createdAt)}
          </span>
        </div>
        <span className={`pq-pill${poll.closed ? ' is-closed' : ''}`}>{poll.closed ? 'Closed' : 'Open'}</span>
      </header>

      <div className="pq-turnout">
        <span>
          <Users size={14} /> {voters} of {total} responded
        </span>
        <b>{pct}%</b>
        <div aria-hidden>
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="pq-res">
        <PollResults poll={poll} votes={db.votes} members={who ? db.members : undefined} />
      </div>

      <footer className="pq-card__foot">
        <span className="pq-type">{poll.multiple ? 'Checkbox' : 'Radio button'}</span>
        <button className="pq-act" onClick={onWho} aria-expanded={who}>
          {who ? 'Hide responses' : 'View responses'}
        </button>
        <button
          className="pq-act"
          onClick={() => {
            setPollClosed(poll.id, !poll.closed)
            toast(poll.closed ? 'Poll reopened' : 'Poll closed')
          }}
        >
          {poll.closed ? (
            <>
              <LockOpen size={14} /> Reopen
            </>
          ) : (
            <>
              <Lock size={14} /> Close poll
            </>
          )}
        </button>
        <button
          className="pq-act pq-act--danger"
          aria-label="Delete poll"
          onClick={async () => {
            if (!(await confirm({ title: 'Delete poll?', message: `"${poll.question}" and its responses will be removed.` }))) return
            deletePoll(poll.id)
            toast('Poll deleted')
          }}
        >
          <Trash2 size={15} />
        </button>
      </footer>
    </article>
  )
}
