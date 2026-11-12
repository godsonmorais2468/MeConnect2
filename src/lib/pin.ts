/**
 * What the four PIN boxes become when something is typed or pasted into box `i`.
 * `focus` is the box to move to next, or null to stay. A PIN never gets past 4 digits:
 * typing again in a full last box does nothing, and typing in a full earlier box replaces its digit.
 */
export function applyPinInput(value: string[], i: number, raw: string): { next: string[]; focus: number | null } {
  const digits = raw.replace(/\D/g, '')
  const had = value[i]

  if (digits.length > 1) {
    if (had && digits.length === 2) {
      /* one more digit typed into a box that already has one */
      if (i === 3) return { next: value, focus: null }
      const fresh = digits.startsWith(had) ? digits[1] : digits[0]
      return { next: value.map((d, k) => (k === i ? fresh : d)), focus: i + 1 }
    }
    /* pasted the whole PIN */
    const pasted = digits.slice(0, 4).split('')
    return { next: [0, 1, 2, 3].map((k) => pasted[k] ?? ''), focus: pasted.length - 1 }
  }

  return { next: value.map((d, k) => (k === i ? digits : d)), focus: digits && i < 3 ? i + 1 : null }
}
