import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Landmark, Map, MapPin, Smartphone, Users } from 'lucide-react'
import { Avatar, Glyph, PageHead, StatStrip } from '../../components/ui'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { fmtDate } from '../../lib/format'
import { matches } from '../../lib/search'
import { useDB } from '../../lib/store'

/** Super Admin: the chapters of one region, opened by clicking that region in the Regions list. */
export default function RegionChapters() {
  const { regionId } = useParams()
  const navigate = useNavigate()
  const db = useDB()
  const [q, setQ] = useState('')
  const region = db.regions.find((r) => r.id === regionId)

  const back = (
    <Link className="btn btn--line btn--sm" to="/admin/regions">
      <ArrowLeft size={16} /> Regions
    </Link>
  )

  if (!region) {
    return (
      <div className="page">
        <PageHead eyebrow="Super Admin" icon={Map} title="Region not found" subtitle="This region may have been deleted." actions={back} />
      </div>
    )
  }

  const chapters = db.chapters.filter((c) => c.regionId === region.id)
  const membersOf = (chapterId: string) => db.members.filter((m) => m.chapterId === chapterId).length
  const shown = chapters.filter((c) => matches(q, c.name, c.code, c.city))

  return (
    <div className="page">
      <PageHead
        eyebrow={`Super Admin · ${region.code ?? 'Region'}`}
        icon={Map}
        title={region.name}
        subtitle={`Chapters of ${region.name}, with the number of members in each.`}
        actions={back}
      />

      <StatStrip
        items={[
          { icon: Landmark, tone: 'wine', label: 'Chapters', value: chapters.length },
          { icon: CheckCircle2, tone: 'green', label: 'Active', value: chapters.filter((c) => c.isActive !== false).length },
          { icon: Users, tone: 'gold', label: 'Members', value: chapters.reduce((sum, c) => sum + membersOf(c.id), 0) },
        ]}
      />

      <div className="list">
        <h2 className="list__title">
          All chapters <span>{chapters.length}</span>
        </h2>
        <ListSearch value={q} onChange={setQ} placeholder="Search chapters" />
        {q && shown.length === 0 && chapters.length > 0 && <NoMatch query={q} />}
        {chapters.length === 0 ? (
          <div className="empty">
            <b>No chapters yet.</b>
            This region has not created any chapter.
          </div>
        ) : (
          shown.map((c) => (
            <article
              key={c.id}
              className={`row row--click ${membersOf(c.id) > 0 ? 'row--green' : ''}`}
              role="link"
              tabIndex={0}
              aria-label={`Members of ${c.name}`}
              onClick={() => navigate(`/admin/regions/${region.id}/chapters/${c.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/admin/regions/${region.id}/chapters/${c.id}`)
                }
              }}
            >
              {c.logo ? <Avatar name={c.name} photo={c.logo} size={50} /> : <Glyph icon={Landmark} tone="wine" size={50} />}
              <div className="row__main">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b>{c.name}</b>
                  {c.isActive === false && <span className="stat stat--bad">Inactive</span>}
                </div>
                <span>
                  {c.code ? `${c.code} · ` : ''}created {fmtDate(c.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="chips">
                {c.city && (
                  <span className="chip">
                    <MapPin size={13} /> {c.city}
                  </span>
                )}
                {c.upiId && (
                  <span className="chip">
                    <Smartphone size={13} /> {c.upiId}
                  </span>
                )}
                <span className="chip chip--gold">{membersOf(c.id)} members</span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
