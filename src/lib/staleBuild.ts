/* After a new version is put on the host, a tab that was already open still points at the OLD file names. Opening a page then asks the host for a file that no longer exists (or gets the home page back in its place), and the page cannot load. The fix is simply to load the new version, once. */
const KEY = 'me-connect:reloaded-at'
const COOLDOWN_MS = 15_000

/** True for the errors a missing or replaced page file produces, in Chrome, Safari and Firefox. */
export function isStaleBuildError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '')
  return /dynamically imported module|importing a module script failed|error loading dynamically|ChunkLoadError|Unable to preload CSS|Loading chunk/i.test(text)
}

/** Reloads the page once to pick up the new version. Returns false when it already did so a moment ago (so a real outage cannot loop). */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < COOLDOWN_MS) return false
    window.sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* no storage: reload anyway, once per call */
  }
  window.location.reload()
  return true
}
