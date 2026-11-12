import { useMemo } from 'react'
import { BookUser } from 'lucide-react'
import MemberDirectory from '../../components/MemberDirectory'
import { PageHead } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { useDB } from '../../lib/store'

export default function Directory() {
  const { member, chapter } = useAuth()
  const db = useDB()

  const chapterId = member?.chapterId
  const all = useMemo(() => db.members.filter((m) => m.chapterId === chapterId), [db.members, chapterId])

  return (
    <div className="page">
      <PageHead eyebrow="Members" icon={BookUser} title="E-Directory" subtitle={`${all.length} members of ${chapter?.name ?? 'your chapter'}, A to Z`} />
      <MemberDirectory members={all} linkTo={(m) => `/directory/${m.id}`} />
    </div>
  )
}
