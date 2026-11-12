/** Looks like a web address: www.site.com, site.in/page, https://site.com */
const DOMAIN = /^(?:https?:\/\/)?(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:[/?#]\S*)?$/i

/**
 * Tidies what someone typed in a Website or Social media box before it is saved:
 * a full link stays, www.site.com / site.com/page gets https://, and @handle becomes an Instagram link.
 * Anything else is kept as typed.
 */
export function normalizeLink(value: string) {
  const v = value.trim()
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  if (/^@[\w.]+$/.test(v)) return `https://instagram.com/${v.slice(1)}`
  if (DOMAIN.test(v)) return `https://${v}`
  return v
}

/** The address to open for a saved value, or null when it is plain text that is not a link. */
export function linkHref(value: string) {
  const v = normalizeLink(value)
  return /^https?:\/\//i.test(v) ? v : null
}
