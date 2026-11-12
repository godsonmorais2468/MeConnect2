import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Landmark } from 'lucide-react'
import MemberDirectory from '../../components/MemberDirectory'
import { PageHead } from '../../components/ui'
import { useDB } from '../../lib/store'

/** Super Admin: the member list of one chapter, opened by clicking that chapter in its region's list. */
export default function ChapterMembers() {
  const { regionId, chapterId } = useParams()
  const db = useDB()
  const chapter = db.chapters.find((c) => c.id === chapterId && c.regionId === regionId)
  const region = db.regions.find((r) => r.id === regionId)
  const members = useMemo(() => db.members.filter((m) => m.chapterId === chapterId), [db.members, chapterId])

  const back = (
    <Link className="btn btn--line btn--sm" to={`/admin/regions/${regionId}`}>
      <ArrowLeft size={16} /> {region?.name ?? 'Regions'}
    </Link>
  )

  if (!chapter) {
    return (
      <div className="page">
        <PageHead eyebrow="Super Admin" icon={Landmark} tone="wine" title="Chapter not found" subtitle="This chapter may have been deleted." actions={back} />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHead
        eyebrow={`Super Admin · ${region?.name ?? 'Region'}`}
        icon={Landmark}
        tone="wine"
        title={chapter.name}
        subtitle={`${members.length} members of ${chapter.name}, A to Z`}
        actions={back}
      />
      <MemberDirectory members={members} linkTo={(m) => `/admin/regions/${regionId}/chapters/${chapterId}/members/${m.id}`} />
    </div>
  )
}
