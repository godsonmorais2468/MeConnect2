import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Download, Smartphone, SlidersHorizontal, UserCheck, UserPlus, Wallet, X } from 'lucide-react'
import { Avatar, Field, PageHead, Sheet, StatStrip } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { downloadReportPdf } from '../../lib/reportPdf'
import { matches } from '../../lib/search'
import { fetchAppUsage, useDB } from '../../lib/store'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import type { AppUsageData, AppUsageRow } from '../../lib/types'

type Activity = 'all' | 'attendance' | 'polls' | 'payments'

const ACTIVITIES: [Activity, string][] = [
  ['all', 'All'],
  ['attendance', 'Attendance'],
  ['polls', 'Polls'],
  ['payments', 'Due Payments'],
]

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
  const { member, chapter: ownChapter } = useAuth()
  const db = useDB()
  /* the Super Admin opens any chapter's report by its id; a head table member always sees their own chapter */
  const { chapterId } = useParams()
  const chapter = chapterId ? db.chapters.find((c) => c.id === chapterId) : ownChapter
  const regionName = chapterId ? db.regions.find((r) => r.id === chapter?.regionId)?.name : undefined
  const [data, setData] = useState<AppUsageData | null>(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  /* the activity to look at: only the members who used it (ticked) are listed */
  const [activity, setActivity] = useState<Activity>('all')
  const [showFilters, setShowFilters] = useState(() => window.matchMedia('(min-width: 721px)').matches)

  useEffect(() => {
    let live = true
    void fetchAppUsage(chapterId).then((res) => {
      if (!live) return
      setFailed(!res)
      if (res) setData(res)
    })
    return () => {
      live = false
    }
  }, [chapterId])

  if (!chapter || (!chapterId && !member)) return null

  const rows = data?.members ?? []
  const photoOf = new Map(db.members.map((m) => [m.id, m.photo]))
  /* with one activity chosen, only the members who used it are listed and only its column shows beside Signup and Profile */
  const chosen = ACTIVITY_COLUMNS.find((c) => c.key === activity)
  const columns = chosen ? [chosen] : ACTIVITY_COLUMNS
  const filtered = chosen ? rows.filter(chosen.used) : rows
  const shown = filtered.filter((r) => matches(q, r.name, r.designation))
  const count = (pick: (r: AppUsageRow) => boolean) => rows.filter(pick).length
  const activeFilters = activity === 'all' ? 0 : 1

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

  return (
    <div className="page">
      <PageHead
        eyebrow={chapterId ? `Super Admin · ${regionName ?? 'Region'}` : `${chapter.name} · ${member?.designation ?? ''}`}
        icon={Smartphone}
        tone="navy"
        title={chapterId ? `${chapter.name} · App Usage` : 'App Usage Report'}
        subtitle="See which members have signed up, completed their profile and use attendance, polls and dues."
        actions={
          <Link className="btn btn--line btn--sm" to={chapterId ? '/admin/app-usage' : '/reports'}>
            <ArrowLeft size={16} /> {chapterId ? 'App Usage' : 'Reports'}
          </Link>
        }
      />

      <StatStrip
        items={[
          { label: 'Members', value: rows.length, icon: UserCheck, tone: 'navy' },
          { label: 'Signed up', value: count((r) => r.signedUp), icon: UserPlus, tone: 'green' },
          { label: 'Profile 100%', value: count((r) => r.profileComplete), icon: Check, tone: 'gold' },
          { label: 'Paid dues', value: count((r) => r.paid), icon: Wallet, tone: 'red' },
        ]}
      />

      <div className="att">
        <button type="button" className="btn btn--line filters-toggle" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal size={16} /> Filters
          {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
        </button>

        <div className={`rfilters ${showFilters ? 'is-open' : ''}`}>
          <Sheet
            icon={SlidersHorizontal}
            tone="red"
            title="Filters"
            note={
              activeFilters > 0 ? (
                <button
                  type="button"
                  className="btn btn--line btn--sm"
                  onClick={() => setActivity('all')}
                >
                  Clear all
                </button>
              ) : undefined
            }
          >
            <div className="form-stack">
              <Field label="Show">
                <div className="seg seg--grid" role="group">
                  {ACTIVITIES.map(([key, text]) => (
                    <button key={key} type="button" aria-pressed={activity === key} onClick={() => setActivity(key)}>
                      {text}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <p className="field__hint">
              A tick means the member has used it at least once: marked their attendance, voted in a poll, or paid a due from the app.
            </p>
          </Sheet>
        </div>

        <div className="list">
          <h2 className="list__title">
            Members <span>{filtered.length}</span>
            <button type="button" className="btn btn--line btn--sm list__act" onClick={downloadPdf} disabled={filtered.length === 0}>
              <Download size={15} /> Download PDF
            </button>
          </h2>
          <ListSearch value={q} onChange={setQ} placeholder="Search member or designation" />
          {q && shown.length === 0 && filtered.length > 0 && <NoMatch query={q} />}

          {failed ? (
            <div className="empty">
              <b>The report could not be loaded.</b>
              Check your connection and open this page again.
            </div>
          ) : !data ? (
            <div className="empty">
              <b>Loading…</b>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <b>No member matches.</b>
              Try other filters.
            </div>
          ) : (
            <div className="usage">
              <table>
                <colgroup>
                  <col />
                  <col className="usage__k usage__k--signup" />
                  <col className="usage__k usage__k--profile" />
                  {columns.map((c) => (
                    <col key={c.key} className={`usage__k usage__k--${c.key}`} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2} className="usage__who">Member</th>
                    <th rowSpan={2}>Signup</th>
                    <th rowSpan={2}>Profile 100%</th>
                    <th colSpan={columns.length} className="usage__group">Activities</th>
                  </tr>
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.member}>
                      <td className="usage__who">
                        <div className="usage__cell">
                          <Avatar name={r.name} photo={photoOf.get(r.member)} size={34} />
                          <span className="usage__text">
                            <b>{r.name}</b>
                            <small>{r.designation.replace(/\//g, '/​')}</small>
                          </span>
                        </div>
                      </td>
                      <td><Mark on={r.signedUp} label="Signed up" /></td>
                      <td><Mark on={r.profileComplete} label="Profile 100%" /></td>
                      {columns.map((c) => (
                        <td key={c.key}><Mark on={c.used(r)} label={c.label} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
