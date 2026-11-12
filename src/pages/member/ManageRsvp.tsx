import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleDot, Eye, ListChecks, Lock, LockOpen, Plus, SquareCheck, Trash2, Users, X } from 'lucide-react'
import PollPreview from '../../components/PollPreview'
import PollResults from '../../components/PollResults'
import { Field, FieldGroup, Glyph, PageHead, PhotoField, Sheet, StatStrip } from '../../components/ui'
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

  if (!region || !myChapter) return null
  const polls = db.polls.filter((p) => p.chapterId === myChapter.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const shown = polls.filter((p) => matches(q, p.question, ...p.options.map((o) => o.text)))
  const answers = polls.reduce((n, p) => n + tally(p, db.votes).voters, 0)

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
  }

  function toggleWho(id: string) {
    setOpenWho((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  return (
    <div className="page">
      <PageHead
        eyebrow={`${myChapter.name} · Head Table`}
        icon={ListChecks}
        tone="green"
        title="Polls"
        subtitle="Ask your chapter a question. Choose radio buttons for one answer, or checkboxes when members can pick several."
      />

      <StatStrip
        items={[
          { icon: ListChecks, tone: 'green', label: 'Polls', value: polls.length },
          { icon: LockOpen, tone: 'gold', label: 'Open', value: polls.filter((p) => !p.closed).length },
          { icon: Users, tone: 'red', label: 'Responses', value: answers },
        ]}
      />

      <div className="duo">
        <Sheet icon={Plus} tone="green" title="Create poll" note={myChapter.name}>
          <form className="form-stack" onSubmit={submit} noValidate>
            <Field label="Poll name or question" required error={errors.question}>
              <input className="field__control" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Will you attend the Annual Day?" />
            </Field>

            <Field label="Description (optional)">
              <textarea
                className="field__control field__control--scroll"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell members more about this poll"
              />
            </Field>

            <PhotoField label="Image (optional)" value={image} onChange={setImage} edge={1280} />

            <FieldGroup label="Answer type" required>
              <div className="kind">
                <button type="button" className={`kind__opt ${!multiple ? 'is-on' : ''}`} aria-pressed={!multiple} onClick={() => setMultiple(false)}>
                  <CircleDot size={20} />
                  <span>
                    <b>Radio button</b>
                    <small>Members choose any one</small>
                  </span>
                </button>
                <button type="button" className={`kind__opt ${multiple ? 'is-on' : ''}`} aria-pressed={multiple} onClick={() => setMultiple(true)}>
                  <SquareCheck size={20} />
                  <span>
                    <b>Checkbox</b>
                    <small>Members choose several</small>
                  </span>
                </button>
              </div>
            </FieldGroup>

            <FieldGroup label="Answer options" required error={errors.options}>
              <ul className="optlist">
                {options.map((text, i) => (
                  <li key={i}>
                    <span className={`optlist__mark ${multiple ? 'is-box' : ''}`} aria-hidden />
                    <input className="field__control" value={text} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`} />
                    <button type="button" className="iconbtn" disabled={options.length <= 2} onClick={() => setOptions((o) => o.filter((_, k) => k !== i))} aria-label={`Remove option ${i + 1}`}>
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              <div>
                <button type="button" className="btn btn--line btn--sm" disabled={options.length >= MAX_OPTIONS} onClick={() => setOptions((o) => [...o, ''])}>
                  <Plus size={15} /> Add option
                </button>
              </div>
            </FieldGroup>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn--primary" type="submit">
                <Plus size={16} /> Publish poll
              </button>
              <button className="btn btn--line" type="button" onClick={() => setPreviewing(true)}>
                <Eye size={16} /> Preview
              </button>
            </div>
          </form>
        </Sheet>
        {previewing && <PollPreview image={image} description={description} onClose={() => setPreviewing(false)} />}

        <div className="list">
          <h2 className="list__title">
            All polls <span>{polls.length}</span>
          </h2>
          <ListSearch value={q} onChange={setQ} placeholder="Search polls" />
          {q && shown.length === 0 && polls.length > 0 && <NoMatch query={q} />}
          {polls.length === 0 ? (
            <div className="empty">
              <b>No polls yet.</b>
              Create the first one and members will see it on their Polls page.
            </div>
          ) : (
            shown.map((p) => (
              <PollCard
                key={p.id}
                poll={p}
                chapterName={db.chapters.find((c) => c.id === p.chapterId)?.name ?? 'Chapter'}
                total={db.members.filter((m) => m.chapterId === p.chapterId && m.loginEnabled !== false).length}
                who={openWho.includes(p.id)}
                onWho={() => toggleWho(p.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function PollCard({ poll, chapterName, total, who, onWho }: { poll: Poll; chapterName: string; total: number; who: boolean; onWho: () => void }) {
  const db = useDB()
  const toast = useToast()
  const confirm = useConfirm()
  const { voters } = tally(poll, db.votes)
  return (
    <article className="pcard">
      <header className="pcard__head">
        <Glyph icon={poll.multiple ? SquareCheck : CircleDot} tone={poll.closed ? 'steel' : 'green'} size={46} />
        <div className="pcard__title">
          <b>{poll.question}</b>
          <span>
            {chapterName} · created {fmtDate(poll.createdAt)}
          </span>
        </div>
        <div className="chips">
          <span className="chip">{poll.multiple ? 'Checkbox' : 'Radio button'}</span>
          <span className={`stat ${poll.closed ? 'stat--idle' : 'stat--ok'}`}>{poll.closed ? 'Closed' : 'Open'}</span>
        </div>
      </header>

      <PollResults poll={poll} votes={db.votes} members={who ? db.members : undefined} />

      <footer className="pcard__foot">
        <div className="pcard__acts">
          <button className="btn btn--line btn--sm" onClick={onWho} aria-expanded={who}>
            {who ? 'Hide responses' : 'View responses'}
          </button>
          <button
            className="btn btn--line btn--sm"
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
            className="iconbtn"
            aria-label="Delete poll"
            onClick={async () => {
              if (!(await confirm({ title: 'Delete poll?', message: `"${poll.question}" and its responses will be removed.` }))) return
              deletePoll(poll.id)
              toast('Poll deleted')
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
        <span className="pcard__count">
          <Users size={15} /> {voters} of {total} responded
        </span>
      </footer>
    </article>
  )
}
