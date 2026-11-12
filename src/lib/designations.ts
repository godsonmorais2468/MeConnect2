import type { DB, Designation, Member } from './types'

/** A default made by the super admin: it has no region and every region gets it. */
export const isDefaultDesignation = (d: Designation) => !d.regionId

/**
 * Every designation a region can use: the super admin's defaults, then the region's own.
 * With a chapter, the designations only that chapter has are added. A default the region has changed or removed is replaced by the region's own version (or dropped), and the same goes for a chapter. If the region has
 * a plain designation with the same name as a default it still uses, the default wins and that copy is hidden.
 */
export function designationsOf(db: DB, regionId: string, chapterId = ''): Designation[] {
  const mine = db.designations.filter((d) => d.regionId === regionId && !d.chapterId)
  const replaced = new Set(mine.filter((d) => d.sourceId).map((d) => d.sourceId))
  const defaults = db.designations.filter((d) => isDefaultDesignation(d) && !replaced.has(d.id))
  const taken = new Set(defaults.map((d) => d.name.toLowerCase()))
  const own = mine.filter((d) => !d.hidden && (d.sourceId || !taken.has(d.name.toLowerCase())))
  const base = [...defaults, ...own]
  if (!chapterId) return base
  /* a chapter's own come last; one it has changed or removed replaces (or drops) the region's or default's */
  const chapterRows = db.designations.filter((d) => d.chapterId === chapterId)
  const chapterReplaced = new Set(chapterRows.filter((d) => d.sourceId).map((d) => d.sourceId))
  return [...base.filter((d) => !chapterReplaced.has(d.id)), ...chapterRows.filter((d) => !d.hidden)]
}

/** Names offered in a Designation dropdown: the region's active designations. `keep` stays selectable even if it was switched off. */
export function designationOptions(db: DB, regionId: string, keep = '', chapterId = ''): string[] {
  const names = designationsOf(db, regionId, chapterId).filter((d) => d.isActive).map((d) => d.name)
  return keep && !names.includes(keep) ? [...names, keep] : names
}

/** The active designation a member holds, if it still exists. */
function heldBy(db: DB, member: Member | null): Designation | undefined {
  if (!member) return undefined
  return designationsOf(db, member.regionId, member.chapterId).find((d) => d.name === member.designation && d.isActive)
}

/** A member sits on the head table when their designation is ticked "Head Table". */
export function isHeadTable(db: DB, member: Member | null): boolean {
  return Boolean(heldBy(db, member)?.isHeadTable)
}

/** Check if member's designation has the 'Attendance' permission ticked. */
export function hasAttendancePermission(db: DB, member: Member | null): boolean {
  if (!member) return false
  const held = heldBy(db, member)
  return Boolean(held && (held.permissions?.includes('Attendance') || /attendance coordinator/i.test(member.designation)))
}

/** Check if member's designation has the 'Visitor Host' permission ticked. */
export function hasVisitorHostPermission(db: DB, member: Member | null): boolean {
  if (!member) return false
  return db.designations.some(
    (d) =>
      d.regionId === member.regionId &&
      d.name === member.designation &&
      d.isActive &&
      (d.permissions?.includes('Visitor Host') || /visitor host/i.test(member.designation))
  )
}

