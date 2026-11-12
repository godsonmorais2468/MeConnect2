import { getDB, getSession } from './store'

/**
 * The "Prepared by" lines printed on every invoice, receipt, statement and voucher of a chapter:
 * `Prepared by : {Name}`, then `Secretary/Treasurer` under it. The name is the chapter's Secretary/Treasurer or, when
 * it has none, whoever is downloading the document (with no second line).
 */
export function preparedByLines(chapterId: string): string[] {
  const db = getDB()
  const active = db.members.filter((m) => m.chapterId === chapterId && m.isActive !== false)
  const holder = active.find((m) => /^secretary\s*\/\s*treasurer$/i.test(m.designation.trim())) ?? active.find((m) => /secretary|treasurer/i.test(m.designation))
  if (holder) return [`Prepared by : ${holder.name}`, 'Secretary/Treasurer']

  const session = getSession()
  let name = ''
  if (session?.role === 'member') name = db.members.find((m) => m.id === session.id)?.name ?? ''
  else if (session?.role === 'region_admin') name = db.regions.find((r) => r.id === session.id)?.adminName ?? ''
  else if (session?.role === 'super_admin') name = 'Super Admin'
  return [name ? `Prepared by : ${name}` : 'Prepared by :']
}
