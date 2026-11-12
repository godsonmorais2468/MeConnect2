import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ClipboardList, IndianRupee, Users } from 'lucide-react'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { Avatar, PageHead, StatStrip } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { fmtDate, inr } from '../../lib/format'
import { matches } from '../../lib/search'
import { fetchDueList, useDB } from '../../lib/store'
import type { DueListData } from '../../lib/types'

/** The members of the chapter who have dues to pay, and the dues (Settings > Due List decides which dues are listed). */
export default function DueList() {
  const { member, chapter } = useAuth()
  const db = useDB()
  const [data, setData] = useState<DueListData | null>(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    let live = true
    void fetchDueList().then((res) => {
      if (!live) return
      if (res) setData(res)
      else setFailed(true)
    })
    return () => {
      live = false
    }
  }, [])

  if (!member || !chapter) return null
  /* the page exists only while the head table has the Due List switched on */
  const on = db.chapters.find((c) => c.id === chapter.id)?.dueListEnabled
  if (on === false || (data && !data.enabled)) return <Navigate to="/" replace />

  const rows = data?.members ?? []
  const shown = rows.filter((r) => matches(q, r.memberName, ...r.dues.map((d) => d.label)))
  const total = rows.reduce((n, r) => n + r.total, 0)
  const byId = new Map(db.members.map((m) => [m.id, m]))
  const note =
    data?.mode === 'due_date'
      ? 'Dues whose due date has passed.'
      : `Dues still unpaid from day ${data?.day ?? 21} of the month they were raised.`

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={ClipboardList}
        tone="red"
        title="Chapter Dues"
        subtitle={`Members with pending dues. ${data ? note : ''}`}
      />

      <StatStrip
        items={[
          { icon: Users, tone: 'red', label: 'Members with dues', value: rows.length },
          { icon: IndianRupee, tone: 'gold', label: 'Total pending', value: inr(total) },
        ]}
      />

      <div className="list">
        <ListSearch value={q} onChange={setQ} placeholder="Search member or due" />
        {q && shown.length === 0 && rows.length > 0 && <NoMatch query={q} />}

        {failed ? (
          <div className="empty">
            <b>Chapter Dues could not be loaded.</b>
            Check your connection and open this page again.
          </div>
        ) : !data ? (
          <div className="empty">
            <b>Loading…</b>
          </div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <b>No pending dues.</b>
            Nobody in the chapter has dues to pay right now.
          </div>
        ) : (
          <ul className="plist plist--dues">
            {shown.map((r) => {
              const m = byId.get(r.member)
              return (
                <li key={r.member} className="prow prow--due">
                  <Avatar name={r.memberName} photo={m?.photo} size={44} />
                  <div className="prow__main">
                    {m ? (
                      <Link to={`/directory/${m.id}`}>
                        <b>{r.memberName}</b>
                      </Link>
                    ) : (
                      <b>{r.memberName}</b>
                    )}
                    {m?.organisation && <span>{m.organisation}</span>}
                    {r.dues.map((d) => (
                      <span key={d.id} className="prow__meta" style={d.overdue ? { color: 'var(--danger)' } : undefined}>
                        {d.label} · {d.dueDate ? `${d.overdue ? 'Overdue since' : 'Due'} ${fmtDate(d.dueDate)}` : 'No due date'} · {inr(d.amount)}
                      </span>
                    ))}
                  </div>
                  <div className="prow__side">
                    <span className="stat stat--bad">{inr(r.total)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
