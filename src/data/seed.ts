/* ============================================================
   Starting data. The app begins empty: everything shown comes
   from the backend or from what people create in the app.
   ============================================================ */
import type { DB } from '../lib/types'

/** Offline fallback login for the super admin when the backend cannot be reached. */
export const SUPER_ADMIN = { id: 'sa', name: 'Super Admin', mobile: '9000000001', pin: '1111' }

/** The usual order of roles in a chapter. Used only to sort people; the list a region offers is the one its admin creates. */
export const DESIGNATIONS = [
  'President',
  'Vice-President',
  'Secretary/Treasurer',
  'Ambassador',
  'Launch Team',
  'Attendance Coordinator',
  'Education Coordinator',
  'Events Coordinator',
  'Visitor Host',
  'Member',
]

/* Request types each chapter can ask for. */
export function buildSeed(): DB {
  return { regions: [], plans: [], chapters: [], designations: [], members: [], meetings: [], attendance: [], invoices: [], requests: [], requestTypes: [], polls: [], votes: [], accountHeads: [], paymentModes: [], financialYears: [], bankAccounts: [], vouchers: [], visitorPayments: [] }
}
