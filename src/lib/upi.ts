/**
 * UPI deep links. A web page cannot see which apps are installed, so each app gets its own
 * link; the phone opens the app if it is there. The generic `upi://` link makes Android show
 * its own list of installed UPI apps.
 */
export interface UpiApp {
  id: string
  name: string
  /** Brand-ish colour for the tile. */
  colour: string
  /** Builds the link from the query string. */
  link: (query: string) => string
}

export const UPI_APPS: UpiApp[] = [
  { id: 'gpay', name: 'Google Pay', colour: '#1A73E8', link: (q) => (isIOS() ? `gpay://upi/pay?${q}` : `tez://upi/pay?${q}`) },
  { id: 'phonepe', name: 'PhonePe', colour: '#5F259F', link: (q) => `phonepe://pay?${q}` },
  { id: 'paytm', name: 'Paytm', colour: '#00B9F1', link: (q) => `paytmmp://pay?${q}` },
  { id: 'bhim', name: 'BHIM', colour: '#E4572E', link: (q) => `upi://pay?${q}` },
]

/** "Other UPI app": the phone shows every UPI app it has installed. */
export const UPI_ANY: UpiApp = { id: 'any', name: 'Other UPI app', colour: '#10233F', link: (q) => `upi://pay?${q}` }

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** Amount, receiver and note, in the form every UPI app understands. */
export function upiQuery({ upiId, name, amount, note }: { upiId: string; name: string; amount: number; note: string }) {
  const p = new URLSearchParams({ pa: upiId, pn: name, am: amount.toFixed(2), cu: 'INR', tn: note.slice(0, 60) })
  return p.toString().replace(/\+/g, '%20').replace('%40', '@')
}
