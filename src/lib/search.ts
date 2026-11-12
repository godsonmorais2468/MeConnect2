/** True when the search text is empty, or any of the fields contains it (ignoring case). */
export function matches(query: string, ...fields: Array<string | number | null | undefined>) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => String(f ?? '').toLowerCase().includes(q))
}
