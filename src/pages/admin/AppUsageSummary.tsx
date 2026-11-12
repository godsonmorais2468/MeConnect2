import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Download, Landmark, Smartphone, SlidersHorizontal, UserCheck, Users } from 'lucide-react'
import { Field, PageHead, Sheet, StatStrip } from '../../components/ui'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import SearchSelect from '../../components/SearchSelect'
import { downloadReportPdf } from '../../lib/reportPdf'
import { matches } from '../../lib/search'
import { fetchAppUsageSummary } from '../../lib/store'
import type { AppUsageChapter } from '../../lib/types'

type Activity = 'all' | 'attendance' | 'polls' | 'payments'

const ACTIVITIES: [Activity, string][] = [
  ['all', 'All'],
  ['attendance', 'Attendance'],
  ['polls', 'Polls'],
  ['payments', 'Due Payments'],
]

/** The three activity columns: how many of a chapter's members have used each at least once. */
const ACTIVITY_COLUMNS: { key: Exclude<Activity, 'all'>; label: string; used: (c: Counts) => number }[] = [
  { key: 'attendance', label: 'Attendance', used: (c) => c.attended },
  { key: 'polls', label: 'Polls', used: (c) => c.voted },
  { key: 'payments', label: 'Due Payments', used: (c) => c.paid },
]

type Counts = Pick<AppUsageChapter, 'members' | 'signedUp' | 'profileComplete' | 'attended' | 'voted' | 'paid'>

const EMPTY: Counts = { members: 0, signedUp: 0, profileComplete: 0, attended: 0, voted: 0, paid: 0 }

const total = (list: Counts[]): Counts =>
  list.reduce(
    (sum, c) => ({
      members: sum.members + c.members,
      signedUp: sum.signedUp + c.signedUp,
      profileComplete: sum.profileComplete + c.profileComplete,
      attended: sum.attended + c.attended,
      voted: sum.voted + c.voted,
      paid: sum.paid + c.paid,
    }),
    EMPTY,
  )

const percentOf = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0)

/** "7 / 12" with a thin bar under it showing how much of the group has done it. A group with no members has nothing to show. */
function Share({ n, of, label }: { n: number; of: number; label: string }) {
  if (of === 0) return <span className="usum__none">—</span>
  const pct = percentOf(n, of)
  return (
    <span className={`usum__share ${n === 0 ? 'is-zero' : ''}`} title={`${label}: ${n} of ${of} members (${pct}%)`}>
      <b>{n}</b> / {of}
      <i style={{ width: `${pct}%` }} />
    </span>
  )
}

/** Super Admin: how much each chapter of every region uses the app, with a line for each region. A chapter opens its member report. */
export default function AppUsageSummary() {
  const navigate = useNavigate()
  const [data, setData] = useState<AppUsageChapter[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  const [regionId, setRegionId] = useState('')
  const [activity, setActivity] = useState<Activity>('all')
  const [showFilters, setShowFilters] = useState(() => window.matchMedia('(min-width: 721px)').matches)

  useEffect(() => {
    let live = true
    void fetchAppUsageSummary().then((res) => {
      if (!live) return
      setFailed(!res)
      if (res) setData(res)
    })
    return () => {
      live = false
    }
  }, [])

  const chapters = data ?? []
  const regions = [...new Map(chapters.map((c) => [c.region, c.regionName])).entries()].map(([id, name]) => ({ id, name }))
  const chosen = ACTIVITY_COLUMNS.find((c) => c.key === activity)
  const columns = chosen ? [chosen] : ACTIVITY_COLUMNS

  /* an inactive chapter takes no new members, so it is left out */
  const filtered = chapters.filter((c) => c.isActive && (!regionId || c.region === regionId))
  const shown = filtered.filter((c) => matches(q, c.name, c.code, c.regionName))
  const all = total(shown)

  /* the chapters come sorted by region, so each region's chapters sit together */
  const groups: { region: string; name: string; code: string; chapters: AppUsageChapter[] }[] = []
  for (const c of shown) {
    const last = groups[groups.length - 1]
    if (last && last.region === c.region) last.chapters.push(c)
    else groups.push({ region: c.region, name: c.regionName, code: c.regionCode, chapters: [c] })
  }

  const activeFilters = (regionId ? 1 : 0) + (activity === 'all' ? 0 : 1)
  const clearFilters = () => {
    setRegionId('')
    setActivity('all')
  }

  const cell = (n: number, of: number) => (of > 0 ? `${n} / ${of} (${percentOf(n, of)}%)` : '—')

  /* the PDF follows the other reports: the chapters listed under the chosen filters, with the same columns as the table */
  function downloadPdf() {
    const line = (c: Counts) => [
      String(c.members),
      cell(c.signedUp, c.members),
      cell(c.profileComplete, c.members),
      ...columns.map((col) => cell(col.used(c), c.members)),
    ]
    downloadReportPdf({
      title: 'App Usage Report',
      subtitle: chosen
        ? `Members who have used ${chosen.label} at least once, chapter by chapter, with their signup and profile status`
        : 'Signup, profile completion and use of attendance, polls and due payments, chapter by chapter',
      chapterName: regionId ? (regions.find((r) => r.id === regionId)?.name ?? 'Region') : 'All regions',
      summaryStats: [
        { label: 'Chapters', value: String(shown.length) },
        { label: 'Members', value: String(all.members) },
        { label: 'Signed up', value: String(all.signedUp) },
        { label: 'Profile 100%', value: String(all.profileComplete) },
      ],
      columns: [
        { title: 'Region', width: 95, bold: false },
        { title: 'Chapter', width: 105, bold: true },
        { title: 'Members', width: 48, bold: false, align: 'center' },
        { title: 'Signed up', width: 78, bold: false, align: 'center' },
        { title: 'Profile 100%', width: 78, bold: false, align: 'center' },
        ...columns.map((col) => ({ title: col.label, width: 78, bold: false, align: 'center' as const })),
      ],
      rows: [...shown.map((c) => [c.regionName, c.name, ...line(c)]), ['', 'All chapters', ...line(all)]],
      filename: 'app-usage-report-all-chapters',
    })
  }

  return (
    <div className="page">
      <PageHead
        eyebrow="Super Admin"
        icon={Smartphone}
        tone="navy"
        title="App Usage"
        subtitle="See how much each chapter of every region has started using the app. Open a chapter to see its members."
      />

      <StatStrip
        items={[
          { label: 'Chapters', value: shown.length, icon: Landmark, tone: 'wine' },
          { label: 'Members', value: all.members, icon: Users, tone: 'navy' },
          { label: 'Signed up', value: all.signedUp, icon: UserCheck, tone: 'green' },
          { label: 'Profile 100%', value: all.profileComplete, icon: Check, tone: 'gold' },
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
                <button type="button" className="btn btn--line btn--sm" onClick={clearFilters}>
                  Clear all
                </button>
              ) : undefined
            }
          >
            <div className="form-stack">
              <Field label="Region">
                <SearchSelect
                  value={regionId}
                  onChange={setRegionId}
                  options={regions}
                  placeholder="All regions"
                  emptyOptionLabel="All regions"
                  searchPlaceholder="Search regions"
                  ariaLabel="Region"
                />
              </Field>
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
              Each figure is the members of the chapter who have done it at least once: set their own MPIN, filled their whole profile,
              marked attendance, voted in a poll, or paid a due from the app.
            </p>
          </Sheet>
        </div>

        <div className="list">
          <h2 className="list__title">
            Chapters <span>{shown.length}</span>
            <button type="button" className="btn btn--line btn--sm list__act" onClick={downloadPdf} disabled={shown.length === 0}>
              <Download size={15} /> Download PDF
            </button>
          </h2>
          <ListSearch value={q} onChange={setQ} placeholder="Search chapter or region" />
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
              <b>No chapter matches.</b>
              Try other filters.
            </div>
          ) : (
            <div className="usage usum">
              <table>
                <colgroup>
                  <col className="usum__first" />
                  <col />
                  <col />
                  <col />
                  {columns.map((c) => (
                    <col key={c.key} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th className="usage__who">Chapter</th>
                    <th>Members</th>
                    <th>Signed up</th>
                    <th>Profile 100%</th>
                    {columns.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                {groups.map((g) => {
                  const roll = total(g.chapters)
                  return (
                    <tbody key={g.region}>
                      <tr className="usum__region">
                        <th scope="row" className="usage__who">
                          {g.name}
                          <small>
                            {g.code ? `${g.code} · ` : ''}
                            {g.chapters.length} {g.chapters.length === 1 ? 'chapter' : 'chapters'}
                          </small>
                        </th>
                        <td>{roll.members}</td>
                        <td><Share n={roll.signedUp} of={roll.members} label="Signed up" /></td>
                        <td><Share n={roll.profileComplete} of={roll.members} label="Profile 100%" /></td>
                        {columns.map((c) => (
                          <td key={c.key}><Share n={c.used(roll)} of={roll.members} label={c.label} /></td>
                        ))}
                      </tr>
                      {g.chapters.map((c) => (
                        <tr
                          key={c.chapter}
                          className="usum__chapter"
                          tabIndex={0}
                          role="link"
                          aria-label={`Members of ${c.name}`}
                          onClick={() => navigate(`/admin/app-usage/${c.chapter}`)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              navigate(`/admin/app-usage/${c.chapter}`)
                            }
                          }}
                        >
                          <th scope="row" className="usage__who">
                            <Link to={`/admin/app-usage/${c.chapter}`} onClick={(e) => e.stopPropagation()} tabIndex={-1}>
                              {c.name}
                            </Link>
                            <small>
                              {c.code || 'No code'}
                              {!c.isActive && <em> · Inactive</em>}
                            </small>
                          </th>
                          <td>{c.members}</td>
                          <td><Share n={c.signedUp} of={c.members} label="Signed up" /></td>
                          <td><Share n={c.profileComplete} of={c.members} label="Profile 100%" /></td>
                          {columns.map((col) => (
                            <td key={col.key}><Share n={col.used(c)} of={c.members} label={col.label} /></td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  )
                })}
                <tfoot>
                  <tr className="usum__total">
                    <th scope="row" className="usage__who">All chapters</th>
                    <td>{all.members}</td>
                    <td><Share n={all.signedUp} of={all.members} label="Signed up" /></td>
                    <td><Share n={all.profileComplete} of={all.members} label="Profile 100%" /></td>
                    {columns.map((c) => (
                      <td key={c.key}><Share n={c.used(all)} of={all.members} label={c.label} /></td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
