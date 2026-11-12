/**
 * After Edit is pressed on a list row, scrolls up to the form that just filled in, but only when the top of that form is
 * out of view (above the screen, or hidden behind the bottom dock). If the form is already in sight the page stays put.
 */
export function showFormIfHidden() {
  const form = document.querySelector('main form')
  const sheet = form?.closest('.sheet') ?? form
  if (!sheet) return
  const { top } = sheet.getBoundingClientRect()
  /* the floating pills cover roughly the first 80px, the dock the last 140px */
  if (top >= 80 && top < window.innerHeight - 140) return
  window.scrollTo({ top: Math.max(0, window.scrollY + top - 96), behavior: 'smooth' })
}
