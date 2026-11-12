import { useDB, useSession } from './store'
import type { Chapter, Member, Region, Role } from './types'

export interface AuthInfo {
  role: Role | null
  /** Display name for the header. */
  name: string
  /** Second line for the header (role, chapter or region). */
  subtitle: string
  member: Member | null
  region: Region | null
  chapter: Chapter | null
}

const NONE: AuthInfo = { role: null, name: '', subtitle: '', member: null, region: null, chapter: null }

/** Who is signed in. `role` is null when nobody is, or when the signed-in record no longer exists. */
export function useAuth(): AuthInfo {
  const session = useSession()
  const db = useDB()
  if (!session) return NONE

  if (session.role === 'super_admin') {
    return { ...NONE, role: 'super_admin', name: 'Super Admin', subtitle: 'Super Admin' }
  }
  if (session.role === 'region_admin') {
    const region = db.regions.find((r) => r.id === session.id)
    if (!region) return NONE
    return { ...NONE, role: 'region_admin', name: region.adminName, subtitle: `Region Admin · ${region.name}`, region }
  }
  const member = db.members.find((m) => m.id === session.id)
  if (!member) return NONE
  const chapter = db.chapters.find((c) => c.id === member.chapterId) ?? null
  const region = db.regions.find((r) => r.id === member.regionId) ?? null
  return { role: 'member', name: member.name, subtitle: chapter ? `${chapter.name} · ${member.designation}` : member.designation, member, region, chapter }
}
