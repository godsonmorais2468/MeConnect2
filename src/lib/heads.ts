import type { AccountHead, DB } from './types'

/** A default made by the super admin: it has no chapter and every chapter gets it. */
export const isDefaultHead = (h: AccountHead) => !h.chapterId

/**
 * Every income/expense head a chapter can use: the super admin's defaults, then the chapter's own.
 * If the chapter has one with the same type and name as a default, the default wins and the chapter's copy is hidden.
 */
export function headsOf(db: DB, chapterId: string): AccountHead[] {
  const all = db.accountHeads || []
  const defaults = all.filter(isDefaultHead)
  const taken = new Set(defaults.map((h) => `${h.headType}:${h.name.toLowerCase()}`))
  const own = all.filter((h) => h.chapterId === chapterId && !taken.has(`${h.headType}:${h.name.toLowerCase()}`))
  return [...defaults, ...own]
}
