/* ============================================================
   Picks how rich the visuals are, so the app runs smoothly on any device.
   high: everything. mid: lighter blur, fewer moving parts. low: flat and still.
   A guess from the hardware sets the start; a live frame-rate check then
   steps down if the device cannot keep up, and remembers that for next time.
   ============================================================ */
export type Tier = 'high' | 'mid' | 'low'

const ORDER: Tier[] = ['high', 'mid', 'low']
const KEY = 'me-connect:perf'
const WINDOW_MS = 2000
const SLOW_FRAME_MS = 26
const DAY_MS = 24 * 60 * 60 * 1000

type Nav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }

const lower = (a: Tier, b: Tier) => ORDER[Math.max(ORDER.indexOf(a), ORDER.indexOf(b))]

function guess(): Tier {
  const nav = navigator as Nav
  if (nav.connection?.saveData) return 'low'
  const cores = nav.hardwareConcurrency || 4
  const memory = nav.deviceMemory ?? 4
  if (cores <= 2 || memory <= 1) return 'low'
  /* phones start in the middle: they have the fewest spare resources, whatever their core count says */
  const phone = window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024
  if (cores <= 4 || memory <= 2 || phone) return 'mid'
  return 'high'
}

/** A step down is remembered for a day, so one bad moment (a busy phone, a slow start) does not keep the plain look forever. */
function saved(): Tier | null {
  try {
    const [v, at] = (window.localStorage.getItem(KEY) ?? '').split(':')
    if (Date.now() - Number(at) > DAY_MS) return null
    return v === 'high' || v === 'mid' || v === 'low' ? v : null
  } catch {
    return null
  }
}

export const getTier = (): Tier => (document.documentElement.dataset.perf as Tier | undefined) ?? 'high'

function apply(tier: Tier) {
  document.documentElement.dataset.perf = tier
}

/** Sets the tier before the first paint and starts watching the frame rate. */
export function initPerf() {
  const forced = new URLSearchParams(window.location.search).get('perf')
  if (forced === 'high' || forced === 'mid' || forced === 'low') {
    apply(forced)
    return
  }

  let tier = lower(guess(), saved() ?? 'high')
  apply(tier)
  if (tier === 'low') return

  /* judge the frame rate in short windows; two slow windows in a row step the tier down one level */
  let windowStart = performance.now()
  let last = windowStart
  let frames = 0
  let slow = 0
  let strikes = 0
  const began = windowStart

  const tick = (now: number) => {
    const dt = now - last
    last = now
    /* a tab that was in the background shows huge gaps: ignore them */
    if (document.visibilityState === 'visible' && dt < 250) {
      frames++
      if (dt > SLOW_FRAME_MS) slow++
    } else {
      windowStart = now
      frames = 0
      slow = 0
    }

    if (now - windowStart >= WINDOW_MS) {
      strikes = frames > 20 && slow / frames > 0.4 ? strikes + 1 : 0
      if (strikes >= 2) {
        tier = ORDER[Math.min(ORDER.indexOf(tier) + 1, ORDER.length - 1)]
        apply(tier)
        try {
          window.localStorage.setItem(KEY, `${tier}:${Date.now()}`)
        } catch {
          /* private mode: it just lasts for this visit */
        }
        strikes = 0
      }
      windowStart = now
      frames = 0
      slow = 0
    }

    if (tier !== 'low' && now - began < 60_000) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
