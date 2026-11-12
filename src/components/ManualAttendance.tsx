import { useState } from 'react'
import { CircleCheck, X } from 'lucide-react'
import { ListSearch, NoMatch } from './ListSearch'
import { Avatar } from './ui'
import { windowOf } from '../lib/attendance'
import { fmtDate } from '../lib/format'
import { useNow } from '../lib/hooks'
import { matches } from '../lib/search'
import { markManualAttendance, useDB } from '../lib/store'
import { useToast } from '../lib/toast'
import type { Meeting } from '../lib/types'

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (ms: number) => `${pad(new Date(ms).getHours())}:${pad(new Date(ms).getMinutes())}`

/**
 * The head table marks members present by hand: everyone the meeting is for who has no attendance yet.
 * The date comes from the meeting and cannot be changed; the time can, and starts at the meeting's start time.
 */
export default function ManualAttendance({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const db = useDB()
  const toast = useToast()
  const w = windowOf(meeting)
  const now = useNow(10_000)
  const [q, setQ] = useState('')
  const [times, setTimes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const marked = new Set(db.attendance.filter((a) => a.meetingId === meeting.id).map((a) => a.memberId))
  const invited = meeting.invitedIds ?? []
  const pending = db.members
    .filter((m) => m.chapterId === meeting.chapterId && m.loginEnabled !== false && (!invited.length || invited.includes(m.id)) && !marked.has(m.id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  const shown = pending.filter((m) => matches(q, m.name, m.designation, m.organisation))

  const dateValue = new Date(w.startsAt).toLocaleDateString('en-CA')
  const timeOf = (id: string) => times[id] ?? hhmm(w.startsAt)

  async function mark(id: string, name: string) {
    const [h, m] = timeOf(id).split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return setErrors((e) => ({ ...e, [id]: 'Enter the time.' }))
    const day = new Date(w.startsAt)
    let at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime()
    /* a meeting that runs past midnight: an earlier clock time belongs to the next day */
    if (at < w.startsAt) at += 24 * 60 * 60_000
    if (at < w.startsAt || at > w.endsAt) return setErrors((e) => ({ ...e, [id]: `Time must be between ${hhmm(w.startsAt)} and ${hhmm(w.endsAt)}.` }))
    if (at > now) return setErrors((e) => ({ ...e, [id]: 'The time cannot be in the future.' }))
    setErrors((e) => ({ ...e, [id]: '' }))
    setBusy(id)
    const res = await markManualAttendance(id, meeting.id, new Date(at).toISOString())
    setBusy('')
    if (res.error) return setErrors((e) => ({ ...e, [id]: res.error ?? '' }))
    toast(`${name} marked present`)
  }

  return (
    <div className="scan" role="dialog" aria-modal="true" aria-label="Manual Attendance" onClick={onClose}>
      <div className="scan__card man" onClick={(e) => e.stopPropagation()}>
        <div className="scan__head">
          <h2>Manual Attendance</h2>
          <button type="button" className="scan__x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="man__meet">
          <b>{meeting.title}</b> · {fmtDate(meeting.startsAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </p>

        {pending.length === 0 ? (
          <div className="empty">
            <b>Everyone is marked.</b>
            No one is left without attendance for this meeting.
          </div>
        ) : (
          <>
            <ListSearch value={q} onChange={setQ} placeholder="Search members" />
            {q && shown.length === 0 && <NoMatch query={q} />}
            <ul className="man__list">
              {shown.map((m) => (
                <li key={m.id} className="man__row">
                  <div className="man__who">
                    <Avatar name={m.name} photo={m.photo} size={40} />
                    <div>
                      <b>{m.name}</b>
                      <span>{m.designation}</span>
                    </div>
                  </div>
                  <div className="man__fields">
                    <label>
                      <span>Date</span>
                      <input type="date" value={dateValue} disabled readOnly aria-label={`Date for ${m.name}`} />
                    </label>
                    <label>
                      <span>Time</span>
                      <input
                        type="time"
                        value={timeOf(m.id)}
                        onChange={(e) => {
                          setTimes((t) => ({ ...t, [m.id]: e.target.value }))
                          setErrors((er) => ({ ...er, [m.id]: '' }))
                        }}
                        aria-label={`Time for ${m.name}`}
                      />
                    </label>
                    <button type="button" className="btn btn--primary btn--sm" disabled={busy === m.id} onClick={() => void mark(m.id, m.name)}>
                      <CircleCheck size={15} /> {busy === m.id ? 'Marking…' : 'Mark present'}
                    </button>
                  </div>
                  {errors[m.id] && <span className="man__err">{errors[m.id]}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
