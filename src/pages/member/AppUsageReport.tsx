import { useEffect, useState } from 'react'
import { Check, Download, Smartphone, X } from 'lucide-react'
import CpHero from '../../components/CpHero'
import { Avatar } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { downloadReportPdf } from '../../lib/reportPdf'
import { matches } from '../../lib/search'
import { fetchAppUsage, useDB } from '../../lib/store'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import type { AppUsageData, AppUsageRow } from '../../lib/types'

type Activity = 'all' | 'attendance' | 'polls' | 'payments'

/** The three activity columns, each with what makes its tick. */
const ACTIVITY_COLUMNS: { key: Exclude<Activity, 'all'>; label: string; used: (r: AppUsageRow) => boolean }[] = [
  { key: 'attendance', label: 'Attendance', used: (r) => r.attended },
  { key: 'polls', label: 'Polls', used: (r) => r.voted },
  { key: 'payments', label: 'Due Payments', used: (r) => r.paid },
]

/** A tick or a cross, and nothing else: the report is for seeing at a glance who uses the app. */
function Mark({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`tick ${on ? 'tick--yes' : 'tick--no'}`} role="img" aria-label={`${label}: ${on ? 'yes' : 'no'}`}>
      {on ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
    </span>
  )
}

/** Which members of the chapter have signed up, completed their profile and use attendance, polls and dues. */
export default function AppUsageReport() {
  /* a head table member always sees their own chapter */
  const { member, chapter } = useAuth()
  const db = useDB()
  const [data, setData] = useState<AppUsageData | null>(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  /* the activity to look at: only the members who used it (ticked) are listed */
  const [activity, setActivity] = useState<Activity>('all')

  useEffect(() => {
    let live = true
    void fetchAppUsage().then((res) => {
      if (!live) return
      setFailed(!res)
      if (res) setData(res)
    })
    return () => {
      live = false
    }
  }, [])

  if (!chapter || !member) return null

  const rows = data?.members ?? []
  const photoOf = new Map(db.members.map((m) => [m.id, m.photo]))
  /* with one activity chosen, only the members who used it are listed and only its column shows beside Signup and Profile */
  const chosen = ACTIVITY_COLUMNS.find((c) => c.key === activity)
  const columns = chosen ? [chosen] : ACTIVITY_COLUMNS
  const filtered = chosen ? rows.filter(chosen.used) : rows
  const shown = filtered.filter((r) => matches(q, r.name, r.designation))
  const count = (pick: (r: AppUsageRow) => boolean) => rows.filter(pick).length

  /* the PDF follows the other reports: the members listed under the chosen filter, with the same columns as the table */
  function downloadPdf() {
    if (!chapter) return
    const yes = (on: boolean) => (on ? 'yes' : 'no')
    downloadReportPdf({
      title: 'App Usage Report',
      subtitle: chosen
        ? `Members who have used ${chosen.label} at least once, with their signup and profile status`
        : 'Signup, profile completion and use of attendance, polls and due payments by member',
      chapterName: chapter.name,
      summaryStats: [
        { label: 'Members', value: String(rows.length) },
        { label: 'Signed up', value: String(count((r) => r.signedUp)) },
        { label: 'Profile 100%', value: String(count((r) => r.profileComplete)) },
        { label: 'Paid dues', value: String(count((r) => r.paid)) },
      ],
      columns: [
        { title: 'Member', width: 130 },
        { title: 'Designation', width: 130, bold: false },
        { title: 'Signup', width: 55, marks: true },
        { title: 'Profile 100%', width: 70, marks: true },
        ...columns.map((c) => ({ title: c.label, width: 62, marks: true })),
      ],
      rows: filtered.map((r) => [r.name, r.designation, yes(r.signedUp), yes(r.profileComplete), ...columns.map((c) => yes(c.used(r)))]),
      filename: `app-usage-report-${chapter.name.toLowerCase().replace(/\s+/g, '-')}`,
    })
  }

  /* the funnel: everyone, then the steps they take. Each step is a bar and, for the activities, a way to filter the list. */
  const steps: { label: string; n: number; key?: Activity }[] = [
    { label: 'Members', n: rows.length },
    { label: 'Signed up', n: count((r) => r.signedUp) },
    { label: 'Profile 100%', n: count((r) => r.profileComplete) },
    { label: 'Attendance', n: count((r) => r.attended), key: 'attendance' },
    { label: 'Polls', n: count((r) => r.voted), key: 'polls' },
    { label: 'Due payments', n: count((r) => r.paid), key: 'payments' },
  ]
  const top = Math.max(1, rows.length)

  return (
    <div className="page au">
      <CpHero
        className="au-hero"
        icon={Smartphone}
        eyebrow={`${chapter.name} · ${member.designation}`}
        title="App Usage Report"
        sub="Who has signed up, completed their profile and uses attendance, polls and dues."
        back={{ to: '/reports', label: 'Reports' }}
      >
        <div className="dr-total">
          <small>Signed up</small>
          <b>{rows.length ? Math.round((count((r) => r.signedUp) / top) * 100) : 0}%</b>
          <span>
            {count((r) => r.signedUp)} of {rows.length} members
          </span>
        </div>
      </CpHero>

      <section className="au-funnel" aria-label="Adoption">
        {steps.map((s) => {
          const pct = Math.round((s.n / top) * 100)
          const body = (
            <>
              <span className="au-step__top">
                <span>{s.label}</span>
                <b>
                  {s.n}
                  <small>{pct}%</small>
                </b>
              </span>
              <span className="au-step__bar">
                <i style={{ width: `${Math.max(pct, s.n ? 3 : 0)}%` }} />
              </span>
            </>
          )
          return s.key ? (
            <button key={s.label} type="button" className={`au-step au-step--btn${activity === s.key ? ' is-on' : ''}`} aria-pressed={activity === s.key} onClick={() => setActivity(activity === s.key ? 'all' : s.key!)}>
              {body}
            </button>
          ) : (
            <div key={s.label} className="au-step">
              {body}
            </div>
          )
        })}
      </section>
      <p className="au-hint">
        A tick means the member has used it at least once: marked their attendance, voted in a poll, or paid a due from the app. Tap Attendance, Polls or Due payments to list only the members who did.
      </p>

      <div className="cr-listbar">
        <h2>
          {chosen ? `Used ${chosen.label}` : 'Members'} <span>{filtered.length}</span>
        </h2>
        <div className="cp-acts">
          {activity !== 'all' && (
            <button type="button" className="cp-act" onClick={() => setActivity('all')}>
              Show all
            </button>
          )}
          <button type="button" className="cp-act" onClick={downloadPdf} disabled={filtered.length === 0}>
            <Download size={15} /> Download PDF
          </button>
        </div>
      </div>
      <ListSearch value={q} onChange={setQ} placeholder="Search member or designation" />
      {q && shown.length === 0 && filtered.length > 0 && <NoMatch query={q} />}

      {failed ? (
        <div className="cp-empty">
          <Smartphone size={30} />
          <b>The report could not be loaded</b>
          <span>Check your connection and open this page again.</span>
        </div>
      ) : !data ? (
        <div className="cp-empty">
          <b>Loading…</b>
        </div>
      ) : filtered.length === 0 ? (
        <div className="cp-empty">
          <b>No member matches</b>
          <span>Try other filters.</span>
        </div>
      ) : (
        <ul className="au-list">
          {shown.map((r) => (
            <li key={r.member} className="au-row">
              <Avatar name={r.name} photo={photoOf.get(r.member)} size={42} />
              <div className="au-row__who">
                <b>{r.name}</b>
                <small>{r.designation.replace(/\//g, '/​')}</small>
              </div>
              <div className="au-row__marks">
                <span className={`au-mark${r.signedUp ? ' is-yes' : ''}`}>
                  <Mark on={r.signedUp} label="Signed up" /> Signup
                </span>
                <span className={`au-mark${r.profileComplete ? ' is-yes' : ''}`}>
                  <Mark on={r.profileComplete} label="Profile 100%" /> Profile
                </span>
                {columns.map((c) => (
                  <span key={c.key} className={`au-mark${c.used(r) ? ' is-yes' : ''}`}>
                    <Mark on={c.used(r)} label={c.label} /> {c.label}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
