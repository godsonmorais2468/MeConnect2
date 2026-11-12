/* eslint-disable @typescript-eslint/no-explicit-any */
/* ============================================================
   ME-CONNECT runs with no server. This file answers every request
   the app makes, in the browser, from sample data kept in
   localStorage. Everything shown here is made up for the prototype.
   ============================================================ */

type Row = Record<string, any>
type Tables = Record<string, Row[]>
export interface DemoAnswer<T> {
  data?: T
  error?: string
  code?: string
  status: number
}

const PREFIX = 'me-connect:demo:'
const SESSION_KEY = 'me-connect:session'
const VISITOR_TOKEN = 'demo-chapter'

/** The sample member the prototype opens as: on the head table, with every permission. */
const ME = 'm3'
const REGION = 'r1'
const CHAPTER = 'c1'

const dayKey = () => new Date().toLocaleDateString('en-CA')
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const iso = () => new Date().toISOString()

/** yyyy-mm-dd, a number of days from today. */
function ymd(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('en-CA')
}

/** A date-time a number of days from today. */
function at(offset: number, hour = 7, minute = 30) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** A birthday or anniversary that falls a number of days from today. */
function yearly(offset: number, year: number) {
  return `${year}${ymd(offset).slice(4)}`
}

const padded = (prefix: string, n: number) => `${prefix}-${String(n).padStart(5, '0')}`
const voucherNumber = (kind: string, n: number) => padded(kind === 'receipt' ? 'REC' : 'VOU', n)

/* ---------- sample data ---------- */

function financialYear() {
  const now = new Date()
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return { start, title: `${start}-${String(start + 1).slice(2)}` }
}

function seed(): Tables {
  const stamp = at(-120)
  const fy = financialYear()

  const regions: Row[] = [
    { id: REGION, code: 'KOC', name: 'Kochi', admin_name: 'Rahul Varma', admin_mobile: '9000000002', email: 'kochi.region@example.com', subscription_start_date: ymd(-120), subscription_end_date: ymd(245), subscription_grandfathered: false, max_chapters: 5, is_active: true, created_at: stamp },
    { id: 'r2', code: 'TVM', name: 'Trivandrum', admin_name: 'Anita Pillai', admin_mobile: '9000000003', email: 'tvm.region@example.com', subscription_start_date: ymd(-60), subscription_end_date: ymd(305), subscription_grandfathered: false, max_chapters: 3, is_active: true, created_at: stamp },
  ]

  const chapters: Row[] = [
    { id: CHAPTER, region: REGION, code: 'HZN', name: 'Horizon', city: 'Kochi', description: 'Weekly breakfast chapter', is_active: true, upi_id: 'horizon@upi', upi_name: 'Horizon Chapter', due_list_enabled: true, due_list_mode: 'default', created_at: stamp },
    { id: 'c2', region: REGION, code: 'SPK', name: 'Spark', city: 'Kochi', description: '', is_active: true, upi_id: '', upi_name: '', due_list_enabled: false, due_list_mode: 'default', created_at: stamp },
    { id: 'c3', region: 'r2', code: 'SUM', name: 'Summit', city: 'Trivandrum', description: '', is_active: true, upi_id: '', upi_name: '', due_list_enabled: false, due_list_mode: 'default', created_at: stamp },
  ]

  const head = (name: string, extra: Row = {}) => ({ id: `d-${name.toLowerCase().replace(/\W+/g, '-')}`, region: REGION, chapter: null, source: null, name, description: '', is_head_table: false, is_leadership_team: false, multi_chapter_login: false, multi_chapter_add_only: false, permissions: [], is_hidden: false, is_active: true, created_at: stamp, ...extra })
  const designations: Row[] = [
    head('President', { is_head_table: true, is_leadership_team: true }),
    head('Vice-President', { is_head_table: true, is_leadership_team: true }),
    head('Secretary/Treasurer', { is_head_table: true, is_leadership_team: true, permissions: ['Attendance', 'Visitor Host'] }),
    head('Ambassador', { is_leadership_team: true }),
    head('Attendance Coordinator', { permissions: ['Attendance'] }),
    head('Education Coordinator'),
    head('Events Coordinator'),
    head('Visitor Host', { permissions: ['Visitor Host'] }),
    head('Member'),
  ]

  const person = (id: string, name: string, designation: string, organisation: string, category: string, extra: Row = {}, chapter = CHAPTER): Row => ({
    id, region: chapter === 'c3' ? 'r2' : REGION, chapter, plan: '', mode: 'monthly', amount: 1500, designation, name,
    mobile: `98${String(10000000 + id.replace(/\D/g, '').padStart(2, '0').length * 7 + Number(id.replace(/\D/g, '')) * 13457)}`,
    organisation, category, photo: '', is_active: true, login_enabled: true, home_chapter_name: '', created_at: stamp,
    email: `${name.split(' ')[0].toLowerCase()}@example.com`, website: 'https://example.com', social: '', dob: yearly(40, 1984), married: 'no', anniversary: '', date_of_joining: ymd(-400), spouse: '', profile_state: 'saved', ...extra,
  })
  const members: Row[] = [
    person('m1', 'Arjun Menon', 'President', 'Menon Builders', 'Construction', { married: 'yes', anniversary: yearly(3, 2012), spouse: 'Lakshmi' }),
    person('m2', 'Divya Thomas', 'Vice-President', 'Thomas & Co Chartered Accountants', 'Accounting'),
    person(ME, 'Priya Nair', 'Secretary/Treasurer', 'Nair Interiors', 'Interior Design', { dob: yearly(0, 1988) }),
    person('m4', 'Rohan Das', 'Ambassador', 'Das Logistics', 'Transport'),
    person('m5', 'Sneha Kurian', 'Attendance Coordinator', 'Bright Smiles Dental', 'Healthcare'),
    person('m6', 'Vivek Iyer', 'Education Coordinator', 'Iyer Legal Associates', 'Legal', { website: '' }),
    person('m7', 'Meera Joseph', 'Events Coordinator', 'Joy Events', 'Event Management', { dob: yearly(6, 1990) }),
    person('m8', 'Karthik Raj', 'Visitor Host', 'Raj Digital', 'Marketing'),
    person('m9', 'Fathima Rasheed', 'Member', 'Rasheed Textiles', 'Retail', { email: '', social: '' }),
    person('m10', 'George Mathew', 'Member', 'Mathew Insurance', 'Insurance'),
    person('m11', 'Nisha Pillai', 'Member', 'Pillai Travels', 'Travel', { website: '', dob: '' }),
    person('m12', 'Sanjay Warrier', 'Member', 'Warrier IT Services', 'Technology', { profile_state: 'skipped', email: '', website: '', dob: '', married: '', date_of_joining: '' }),
    person('m13', 'Asha Paul', 'President', 'Paul Bakers', 'Food', {}, 'c2'),
    person('m14', 'Imran Khan', 'Member', 'Khan Motors', 'Automobile', {}, 'c2'),
    person('m15', 'Deepa Krishnan', 'Member', 'Krishnan Consulting', 'Consulting', {}, 'c3'),
  ]
  const mine = members.filter((m) => m.chapter === CHAPTER)
  const everyone = mine.map((m) => m.id)

  const meeting = (id: string, title: string, startsAt: string, extra: Row = {}): Row => ({ id, region: REGION, chapter: CHAPTER, title, mode: 'offline', starts_at: startsAt, duration_min: 90, venue: 'Grand Hall, MG Road, Kochi', lat: 9.9674, lng: 76.2853, radius_m: 150, audience: 'all', audience_designations: [], invitees: [], invited_ids: everyone, created_at: stamp, ...extra })
  const meetings: Row[] = [
    meeting('mt-today', 'Weekly Meeting', iso()),
    meeting('mt-next', 'Weekly Meeting', at(7)),
    meeting('mt-online', 'Leadership Review', at(3, 19, 0), { mode: 'online', venue: 'https://meet.example.com/horizon', lat: null, lng: null, audience: 'designations', audience_designations: ['President', 'Vice-President', 'Secretary/Treasurer'] }),
    meeting('mt-1', 'Weekly Meeting', at(-7)),
    meeting('mt-2', 'Weekly Meeting', at(-14)),
    meeting('mt-3', 'Weekly Meeting', at(-21)),
  ]

  const attendance: Row[] = ['mt-1', 'mt-2', 'mt-3'].flatMap((mt, i) =>
    mine
      .filter((_, n) => (n + i) % 5 !== 4)
      .map((m, n) => ({ id: `at-${mt}-${m.id}`, meeting: mt, member: m.id, method: n % 3 === 0 ? 'geofence' : 'qr', marked_at: at(-7 * (i + 1), 7, 25 + (n % 5)), distance_m: 20 + n * 4 })),
  )
  attendance.push({ id: 'at-today-m1', meeting: 'mt-today', member: 'm1', method: 'qr', marked_at: iso(), distance_m: 18 }, { id: 'at-today-m2', meeting: 'mt-today', member: 'm2', method: 'qr', marked_at: iso(), distance_m: 26 })

  const accountHead = (id: string, name: string, type: string, chapter: string | null = CHAPTER): Row => ({ id, region: chapter ? REGION : null, chapter, head_type: type, name, comment: '', is_active: true, created_at: stamp, updated_at: stamp })
  const accountHeads: Row[] = [
    accountHead('h0', 'Membership Fees', 'income', null),
    accountHead('h00', 'Office Expenses', 'expense', null),
    accountHead('h1', 'Monthly Meeting Fees', 'income'),
    accountHead('h2', 'Annual Event Contribution', 'income'),
    accountHead('h3', 'Visitor Fees', 'income'),
    accountHead('h4', 'Venue Rent', 'expense'),
    accountHead('h5', 'Refreshments', 'expense'),
  ]

  const mode = (id: string, name: string, code: string): Row => ({ id, region: REGION, chapter: CHAPTER, name, code, description: '', is_active: true, created_at: stamp, updated_at: stamp })
  const paymentModes = [mode('pm1', 'Cash', 'CASH'), mode('pm2', 'UPI', 'UPI'), mode('pm3', 'Cheque', 'CHQ')]

  const financialYears: Row[] = [{ id: 'fy1', region: REGION, chapter: CHAPTER, title: fy.title, start_date: `${fy.start}-04-01`, end_date: `${fy.start + 1}-03-31`, bill_start_number: 1, invoice_prefix: 'INV', invoice_start_number: 1, receipt_prefix: 'REC', receipt_start_number: 1, voucher_prefix: 'VOU', voucher_start_number: 1, is_current: true, is_locked: false, created_at: stamp, updated_at: stamp }]
  const bankAccounts: Row[] = [{ id: 'b1', region: REGION, chapter: CHAPTER, bank_name: 'Sample Bank', account_name: 'Horizon Chapter Account', account_number: '000123456789', ifsc_code: 'SMPL0001234', branch: 'MG Road', upi_id: 'horizon@upi', opening_balance: 25000, is_default: true, is_active: true, created_at: stamp, updated_at: stamp }]

  const voucher = (id: string, kind: string, number: number, offset: number, headId: string, headName: string, amount: number, remarks: string): Row => ({ id, region: REGION, chapter: CHAPTER, financial_year: 'fy1', financial_year_title: fy.title, kind, number: voucherNumber(kind, number), date: ymd(offset), head: headId, head_name: headName, amount: amount.toFixed(2), mode_name: 'UPI', remarks, created_at: at(offset) })
  const vouchers = [voucher('v1', 'payment', 1, -20, 'h4', 'Venue Rent', 8000, 'Hall rent'), voucher('v2', 'payment', 2, -7, 'h5', 'Refreshments', 3200, 'Breakfast'), voucher('v3', 'receipt', 100, -10, 'h2', 'Annual Event Contribution', 5000, 'Sponsor')]

  const requests: Row[] = [
    { id: 'pr1', region: REGION, chapter: CHAPTER, head: 'h1', type_name: 'Monthly Meeting Fees', amount: '1500.00', description: 'Last month', due_date: ymd(-25), member_ids: everyone, recurrence: null, created_at: at(-35) },
    { id: 'pr2', region: REGION, chapter: CHAPTER, head: 'h1', type_name: 'Monthly Meeting Fees', amount: '1500.00', description: 'This month', due_date: ymd(5), member_ids: everyone, recurrence: null, created_at: at(-5) },
  ]
  let no = 0
  const invoice = (m: Row, request: string, label: string, dueDate: string, status: string, offset: number, method = 'UPI'): Row => {
    no += 1
    const paid = status !== 'due'
    return { id: `inv-${no}`, no: `INV-${fy.start}-${String(no).padStart(5, '0')}`, created_at: at(offset - 5), member: m.id, label, amount: '1500.00', due_date: dueDate, status, paid_at: paid ? at(offset) : null, verified_at: status === 'paid' ? at(offset) : null, method: paid ? method : null, mode_name: paid ? method : null, ref: paid ? padded('REC', no) : null, kind: null, request, pay_all: false, description: '' }
  }
  const invoices: Row[] = [
    ...mine.map((m, i) => invoice(m, 'pr1', 'Monthly Meeting Fees', ymd(-25), i === 8 || i === 11 ? 'due' : 'paid', -26 + (i % 4), i % 3 === 0 ? 'Cash' : 'UPI')),
    ...mine.map((m, i) => invoice(m, 'pr2', 'Monthly Meeting Fees', ymd(5), i < 3 ? 'paid' : i === 5 ? 'pending' : m.id === ME ? 'due' : 'due', -2)),
  ]
  /* the signed-in sample member has one thing to pay */
  const myDue = invoices.find((i) => i.member === ME && i.request === 'pr2')
  if (myDue) Object.assign(myDue, { status: 'due', paid_at: null, verified_at: null, method: null, mode_name: null, ref: null })

  const polls: Row[] = [
    { id: 'p1', region: REGION, chapter: CHAPTER, question: 'Which day suits the annual family meet?', description: 'Pick the day that works for you.', image: '', multiple: false, closed: false, created_at: at(-3), total_votes: 4, options: [{ id: 'p1a', text: 'Saturday', votes_count: 3 }, { id: 'p1b', text: 'Sunday', votes_count: 1 }], votes: [{ id: 'p1v1', member: 'm1', option_ids: ['p1a'], at: at(-2) }, { id: 'p1v2', member: 'm2', option_ids: ['p1a'], at: at(-2) }, { id: 'p1v3', member: 'm4', option_ids: ['p1b'], at: at(-2) }, { id: 'p1v4', member: 'm5', option_ids: ['p1a'], at: at(-1) }] },
    { id: 'p2', region: REGION, chapter: CHAPTER, question: 'Breakfast menu for next quarter', description: '', image: '', multiple: true, closed: true, created_at: at(-20), total_votes: 3, options: [{ id: 'p2a', text: 'South Indian', votes_count: 3 }, { id: 'p2b', text: 'Continental', votes_count: 1 }], votes: [{ id: 'p2v1', member: ME, option_ids: ['p2a'], at: at(-18) }, { id: 'p2v2', member: 'm1', option_ids: ['p2a', 'p2b'], at: at(-18) }, { id: 'p2v3', member: 'm2', option_ids: ['p2a'], at: at(-18) }] },
  ]

  const plans: Row[] = [
    { id: 'pl1', name: 'Standard Plan', description: 'For a whole region', scope_type: 'region', billing_cycle: 'yearly', rate: '24000.00', tax_percent: '18.00', region: null, applicable_regions: [REGION, 'r2'], applicable_region_names: ['Kochi', 'Trivandrum'], chapter: null, member: null, can_delete: false },
    { id: 'pl2', name: 'Chapter Plan', description: 'For one chapter', scope_type: 'chapter', billing_cycle: 'quarterly', rate: '6000.00', tax_percent: '18.00', region: REGION, applicable_regions: [REGION], applicable_region_names: ['Kochi'], chapter: CHAPTER, member: null, can_delete: true },
  ]
  const subscription = (id: string, region: Row): Row => ({ id, plan: 'pl1', plan_name: 'Standard Plan', plan_billing_cycle: 'yearly', scope_type: 'region', region: region.id, region_name: region.name, chapter: null, chapter_name: '', member_profile: null, member_name: '', purchased_by: null, purchased_by_name: region.admin_name, status: 'active', start_date: region.subscription_start_date, current_period_start: region.subscription_start_date, current_period_end: region.subscription_end_date, grace_period_end: null, base_amount: '24000.00', tax_percent: '18.00', tax_amount: '4320.00', total_amount: '28320.00', currency: 'INR', cancelled_at: null, cancellation_reason: '', latest_payment_status: 'verified', latest_payment_verified_at: stamp, latest_payment_txn_id: `TXN${id.toUpperCase()}`, latest_payment_gateway_id: '', created_at: stamp, updated_at: stamp })
  const subscriptions = regions.map((r, i) => subscription(`s${i + 1}`, r))
  const subscriptionPayments: Row[] = subscriptions.map((s) => ({ id: `sp-${s.id}`, subscription: s.id, plan: s.plan, plan_name: s.plan_name, plan_billing_cycle: 'yearly', scope_type: 'region', status: 'verified', merchant_txn_id: s.latest_payment_txn_id, gateway_payment_id: '', base_amount: s.base_amount, tax_amount: s.tax_amount, total_amount: s.total_amount, currency: 'INR', initiated_at: stamp, verified_at: stamp, region: s.region, region_id: s.region, region_name: s.region_name, chapter: null, chapter_id: null, chapter_name: '' }))

  return {
    regions, plans, chapters, meetings, polls, members, invoices, attendance, designations, accountHeads, paymentModes, financialYears, bankAccounts, vouchers, requests, subscriptions, subscriptionPayments,
    visitorPayments: [{ id: 'vp1', chapter: CHAPTER, visitor_name: 'Ajay Kumar', visitor_phone: '9800000011', referred_by_name: 'Arjun Menon', payment_mode: 'UPI', payment_amount: '500.00', payment_receipt: 'VR-0001', paid_at: at(-7), reference: 'VIS-0001' }],
    substitutes: [{ id: 'sb1', chapter: CHAPTER, meeting: 'mt-1', member: 'm9', substitute_name: 'Rafi Rasheed', substitute_phone: '9800000012', created_at: at(-7) }],
    visitors: [{ id: 'vr1', chapter: CHAPTER, meeting: 'mt-1', referred_by: 'm1', visitor_name: 'Ajay Kumar', visitor_phone: '9800000011', created_at: at(-7) }],
  }
}

/* ---------- storage ---------- */

const storageKey = () => `${PREFIX}v2:${dayKey()}`

function load(): Tables {
  const key = storageKey()
  let tables: Tables | null = null
  try {
    const raw = window.localStorage.getItem(key)
    if (raw) tables = JSON.parse(raw) as Tables
    else {
      /* sample dates are counted from today, so a new day starts fresh */
      for (const k of Object.keys(window.localStorage)) if (k.startsWith(PREFIX)) window.localStorage.removeItem(k)
    }
  } catch {
    /* blocked storage: the sample data still works for this visit */
  }
  const t = tables ?? seed()
  /* today's meeting is always in progress when the prototype is opened, so attendance and visitor screens have something live to show */
  const live = t.meetings.find((m) => m.id === 'mt-today')
  if (live) live.starts_at = new Date(Date.now() - 10 * 60_000).toISOString()
  return t
}

const tables = load()

function save() {
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(tables))
  } catch {
    /* storage full: changes last until the page is closed */
  }
}

function signedIn(): { role?: string; id?: string } {
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = store.getItem(SESSION_KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      /* blocked storage */
    }
  }
  return {}
}

/* ---------- helpers for the answers ---------- */

const ok = <T>(data: T, status = 200): DemoAnswer<T> => ({ data, status })
const memberById = (id: unknown) => tables.members.find((m) => m.id === id)
const chapterById = (id: unknown) => tables.chapters.find((c) => c.id === id)
const regionById = (id: unknown) => tables.regions.find((r) => r.id === id)
const headById = (id: unknown) => tables.accountHeads.find((h) => h.id === id)

function membership(m: Row) {
  return { member_id: m.id, chapter_id: m.chapter, chapter_name: chapterById(m.chapter)?.name ?? '', region_name: regionById(m.region)?.name ?? '', designation: m.designation }
}

function login(as: string) {
  const tokens = { access: 'prototype', refresh: 'prototype' }
  if (as === 'super_admin') return { user: { id: 'sa', name: 'Super Admin', mobile: '', role: 'super_admin' }, tokens, memberships: [] }
  if (as === 'region_admin') {
    const region = tables.regions[0]
    return { user: { id: 'ra', name: region.admin_name, mobile: region.admin_mobile, role: 'region_admin', region_id: region.id }, tokens, memberships: [] }
  }
  const m = memberById(ME) as Row
  return { user: { id: 'u3', name: m.name, mobile: m.mobile, role: 'member', member_id: m.id }, tokens, memberships: [membership(m)] }
}

function currentSubscription() {
  const s = tables.subscriptions[0]
  const r = tables.regions[0]
  return {
    allowed: true, code: null, state: 'active', source: 'subscription', message: '', as_of: iso(), billing_allowed: true,
    region: { id: r.id, name: r.name, is_active: true, grandfathered: false, legacy_start_date: null, legacy_end_date: null },
    subscription: { id: s.id, status: s.status, plan_id: s.plan, plan: s.plan, plan_name: s.plan_name, billing_cycle: s.plan_billing_cycle, scope_type: 'region', base_amount: s.base_amount, tax_percent: s.tax_percent, tax_amount: s.tax_amount, total_amount: s.total_amount, currency: 'INR', chapter_name: null, member_name: null, start_date: s.start_date, current_period_start: s.current_period_start, current_period_end: s.current_period_end, grace_period_end: null },
    plan: null,
  }
}

function dueList() {
  const chapter = chapterById(CHAPTER) as Row
  const today = ymd()
  const rows = tables.members
    .filter((m) => m.chapter === CHAPTER)
    .map((m) => {
      const dues = tables.invoices.filter((i) => i.member === m.id && i.status === 'due')
      return {
        member: m.id,
        member_name: m.name,
        total: dues.reduce((n, i) => n + Number(i.amount), 0),
        dues: dues.map((i) => ({ id: i.id, label: i.label, amount: i.amount, due_date: i.due_date, overdue: Boolean(i.due_date) && i.due_date < today })),
      }
    })
    .filter((r) => r.dues.length)
  return { enabled: Boolean(chapter.due_list_enabled), mode: chapter.due_list_mode, day: 21, members: rows }
}

function usageOf(m: Row) {
  return {
    member: m.id,
    name: m.name,
    designation: m.designation,
    signed_up: m.profile_state !== 'pending',
    profile_complete: Boolean(m.email && m.website && m.dob && m.date_of_joining),
    attended: tables.attendance.some((a) => a.member === m.id),
    voted: tables.polls.some((p) => p.votes.some((v: Row) => v.member === m.id)),
    paid: tables.invoices.some((i) => i.member === m.id && i.status === 'paid'),
  }
}

function usageSummary() {
  const count = (rows: ReturnType<typeof usageOf>[], key: 'signed_up' | 'profile_complete' | 'attended' | 'voted' | 'paid') => rows.filter((r) => r[key]).length
  return {
    chapters: tables.chapters.map((c) => {
      const rows = tables.members.filter((m) => m.chapter === c.id).map(usageOf)
      const r = regionById(c.region)
      return { chapter: c.id, name: c.name, code: c.code, is_active: c.is_active, region: c.region, region_name: r?.name ?? '', region_code: r?.code ?? '', members: rows.length, signed_up: count(rows, 'signed_up'), profile_complete: count(rows, 'profile_complete'), attended: count(rows, 'attended'), voted: count(rows, 'voted'), paid: count(rows, 'paid') }
    }),
  }
}

/* ---------- payments ---------- */

const payMethod = (name: unknown) => (name === 'UPI' || name === 'Cheque' ? name : 'Cash')

function applyPayment(inv: Row, body: Row, status: 'pending' | 'paid', receipt: string) {
  Object.assign(inv, { status, paid_at: iso(), verified_at: status === 'paid' ? iso() : null, method: payMethod(body.mode_name), mode_name: body.mode_name || 'Cash', ref: receipt, txn_id: body.txn_id || '', txn_date: body.txn_date || null, cheque_no: body.cheque_no || '', cheque_date: body.cheque_date || null })
}

const nextReceipt = () => padded('REC', 200 + tables.invoices.filter((i) => i.ref).length)

function pay(body: Row, status: 'pending' | 'paid') {
  const picked = body.pay_all
    ? tables.invoices.filter((i) => i.request === body.request_id && i.member === body.member && i.status === 'due')
    : tables.invoices.filter((i) => (body.invoice_ids as string[]).includes(i.id))
  const receipt = nextReceipt()
  picked.forEach((i) => applyPayment(i, body, status, receipt))
  return ok({ invoices: picked, receipt })
}

function verify(body: Row) {
  const picked = tables.invoices.filter((i) => (body.invoice_ids as string[]).includes(i.id))
  picked.forEach((i) => Object.assign(i, { status: 'paid', verified_at: iso() }))
  return ok({ invoices: picked })
}

function manualInvoice(body: Row) {
  const row: Row = { id: uid('inv'), no: `INV-M-${tables.invoices.length + 1}`, created_at: iso(), member: body.member, label: headById(body.head)?.name ?? 'Payment', amount: body.amount, due_date: '', kind: 'manual', request: null, pay_all: false, description: body.description || '' }
  const receipt = nextReceipt()
  applyPayment(row, body, 'paid', receipt)
  tables.invoices.push(row)
  return ok({ ...row, invoices: [row], receipt })
}

function undoPayment(body: Row) {
  const inv = tables.invoices.find((i) => i.id === body.invoice_id)
  if (!inv) return ok({ invoices: [], removed: [] })
  if (inv.kind === 'manual') {
    tables.invoices = tables.invoices.filter((i) => i.id !== inv.id)
    return ok({ invoices: [], removed: [inv.id] })
  }
  Object.assign(inv, { status: 'due', paid_at: null, verified_at: null, method: null, mode_name: null, ref: null })
  return ok({ invoices: [inv], removed: [] })
}

function createRequest(row: Row) {
  row.type_name = headById(row.head)?.name ?? ''
  row.region = chapterById(row.chapter)?.region ?? REGION
  for (const member of (row.member_ids as string[]) ?? []) {
    tables.invoices.push({ id: uid('inv'), no: `INV-R-${tables.invoices.length + 1}`, created_at: iso(), member, label: row.type_name, amount: row.amount, due_date: row.due_date || row.recurrence?.from || '', status: 'due', paid_at: null, verified_at: null, method: null, mode_name: null, ref: null, kind: null, request: row.id, pay_all: false, description: row.description || '' })
  }
}

/* ---------- polls ---------- */

function vote(pollId: string, optionIds: string[]) {
  const poll = tables.polls.find((p) => p.id === pollId)
  if (!poll) return { error: 'Poll not found.', status: 404 }
  const member = signedIn().id ?? ME
  poll.votes = [...poll.votes.filter((v: Row) => v.member !== member), { id: uid('pv'), member, option_ids: optionIds, at: iso() }]
  poll.total_votes = poll.votes.length
  for (const o of poll.options) o.votes_count = poll.votes.filter((v: Row) => v.option_ids.includes(o.id)).length
  return ok({ id: poll.id })
}

/* ---------- public visitor pages ---------- */

const publicMember = (m: Row) => ({ id: m.id, name: m.name, designation: m.designation, organisation: m.organisation, category: m.category })

function visitorInfo() {
  const chapter = chapterById(CHAPTER) as Row
  const m = tables.meetings.find((x) => x.id === 'mt-today') as Row
  const people = tables.members.filter((x) => x.chapter === CHAPTER).map(publicMember)
  return {
    chapter: { name: chapter.name, city: chapter.city, code: chapter.code },
    meeting: { id: m.id, title: m.title, starts_at: m.starts_at, duration_min: m.duration_min, mode: m.mode, venue: m.venue, is_today: true, is_finished: false },
    substitute_enabled: true,
    substitute_disabled_reason: '',
    members: people,
    substitute_eligible_members: people,
    payment_modes: tables.paymentModes.map((p) => p.name),
  }
}

function registerVisitor(body: Row) {
  const n = tables.visitors.length + 1
  const reference = `VIS-${String(n).padStart(4, '0')}`
  const chapter = chapterById(CHAPTER) as Row
  const referredBy = memberById(body.referred_by)
  tables.visitors.push({ id: uid('vr'), chapter: CHAPTER, meeting: 'mt-today', referred_by: body.referred_by, visitor_name: body.visitor_name, visitor_phone: body.visitor_phone, created_at: iso(), reference })
  tables.visitorPayments.push({ id: uid('vp'), chapter: CHAPTER, visitor_name: body.visitor_name, visitor_phone: body.visitor_phone, referred_by_name: referredBy?.name ?? '', payment_mode: body.payment_mode, payment_amount: body.payment_amount, payment_receipt: `VR-${String(n).padStart(4, '0')}`, paid_at: iso(), reference })
  return ok({ success: true, reference, visitor_name: body.visitor_name, visitor_phone: body.visitor_phone, chapter_name: chapter.name, meeting_title: 'Weekly Meeting', referred_by_name: referredBy?.name ?? null, payment_mode: body.payment_mode, payment_amount: body.payment_amount, payment_receipt: `VR-${String(n).padStart(4, '0')}`, registered_at: iso() })
}

function registerSubstitute(body: Row) {
  const reference = `SUB-${String(tables.substitutes.length + 1).padStart(4, '0')}`
  tables.substitutes.push({ id: uid('sb'), chapter: CHAPTER, meeting: 'mt-today', member: body.target_member_id, substitute_name: body.substitute_name, substitute_phone: body.substitute_phone, created_at: iso(), reference })
  return ok({ success: true, reference })
}

function registrationDetail(reference: string) {
  const chapter = chapterById(CHAPTER) as Row
  const m = tables.meetings.find((x) => x.id === 'mt-today') as Row
  const sub = tables.substitutes.find((s) => s.reference === reference)
  if (sub) return ok({ registration_type: 'substitute', reference, name: sub.substitute_name, chapter_name: chapter.name, meeting_title: m.title, meeting_starts_at: m.starts_at, substituting_for_name: memberById(sub.member)?.name ?? null, registered_at: sub.created_at })
  const visitor = tables.visitors.find((v) => v.reference === reference)
  if (!visitor) return { error: 'Registration details not found. The reference may be invalid or expired.', status: 404 }
  const paid = tables.visitorPayments.find((p) => p.reference === reference)
  return ok({ registration_type: 'visitor', reference, name: visitor.visitor_name, chapter_name: chapter.name, meeting_title: m.title, meeting_starts_at: m.starts_at, referred_by_name: paid?.referred_by_name || null, payment_status: 'paid', payment_mode: paid?.payment_mode, payment_amount: paid?.payment_amount, payment_receipt: paid?.payment_receipt, registered_at: visitor.created_at })
}

/* ---------- plain lists: read, add, change, remove ---------- */

const COLLECTIONS: [string, string][] = [
  ['/chapters/meetings/', 'meetings'],
  ['/chapters/polls/', 'polls'],
  ['/chapters/', 'chapters'],
  ['/masters/plans/', 'plans'],
  ['/masters/designations/', 'designations'],
  ['/masters/account-heads/', 'accountHeads'],
  ['/masters/payment-modes/', 'paymentModes'],
  ['/masters/financial-years/', 'financialYears'],
  ['/masters/bank-accounts/', 'bankAccounts'],
  ['/masters/vouchers/', 'vouchers'],
  ['/members/invoices/', 'invoices'],
  ['/members/attendance/', 'attendance'],
  ['/members/payment-requests/', 'requests'],
  ['/members/visitor-payments/', 'visitorPayments'],
  ['/members/substitute-registrations/', 'substitutes'],
  ['/members/visitor-registrations/', 'visitors'],
  ['/members/team/', 'members'],
  ['/members/', 'members'],
  ['/regions/', 'regions'],
  ['/subscriptions/', 'subscriptions'],
]

/** What a new row needs beyond what the form sent. */
function complete(key: string, row: Row) {
  if (row.chapter && !row.region) row.region = chapterById(row.chapter)?.region ?? REGION
  if (key === 'polls') {
    row.options = ((row.option_texts as string[]) ?? []).map((text) => ({ id: uid('po'), text, votes_count: 0 }))
    Object.assign(row, { votes: [], closed: false, total_votes: 0 })
  }
  if (key === 'members') Object.assign(row, { plan: '', mode: 'monthly', amount: 0, login_enabled: true, category: row.category ?? '', profile_state: 'pending' })
  if (key === 'attendance') Object.assign(row, { member: row.member ?? signedIn().id ?? ME, marked_at: row.marked_at ?? iso(), distance_m: 0 })
  if (key === 'requests') createRequest(row)
  if (key === 'vouchers') {
    const same = tables.vouchers.filter((v) => v.kind === row.kind)
    Object.assign(row, { number: voucherNumber(row.kind, 300 + same.length), head_name: headById(row.head)?.name ?? '', financial_year: row.financial_year ?? 'fy1', financial_year_title: tables.financialYears[0]?.title ?? '' })
  }
  if (key === 'plans') {
    const ids = (row.applicable_regions as string[]) ?? (row.region ? [row.region] : [])
    Object.assign(row, { applicable_regions: ids, applicable_region_names: ids.map((id) => regionById(id)?.name ?? ''), can_delete: true })
  }
}

function collection(path: string, method: string, query: URLSearchParams, body: Row): DemoAnswer<any> | null {
  const found = COLLECTIONS.find(([prefix]) => path.startsWith(prefix) && !path.slice(prefix.length).replace(/\/$/, '').includes('/'))
  if (!found) return null
  const [prefix, key] = found
  const id = path.slice(prefix.length).replace(/\/$/, '')

  if (!id) {
    if (method === 'GET') {
      const chapter = query.get('chapter')
      return ok(chapter ? tables[key].filter((r) => r.chapter === chapter) : tables[key])
    }
    const row: Row = { id: uid(key), created_at: iso(), updated_at: iso(), is_active: true, ...body }
    complete(key, row)
    tables[key] = key === 'requests' ? [row, ...tables[key]] : [...tables[key], row]
    return ok(row, 201)
  }

  const row = tables[key].find((r) => r.id === id)
  if (!row) return { error: 'Not found.', status: 404 }
  if (method === 'GET') return ok(row)
  if (method === 'DELETE') {
    tables[key] = tables[key].filter((r) => r !== row)
    return { status: 204 }
  }
  Object.assign(row, body, { updated_at: iso() })
  return ok(row)
}

/* ---------- the requests ---------- */

function answer(path: string, method: string, query: URLSearchParams, body: Row): DemoAnswer<any> {
  switch (path) {
    case '/auth/login/':
      return ok(login(String(body.mobile ?? '')))
    case '/auth/memberships/': {
      const m = memberById(signedIn().id)
      return ok({ memberships: m ? [membership(m)] : [] })
    }
    case '/auth/switch-chapter/':
      return ok(login('member'))
    case '/auth/change-pin/':
    case '/auth/password-reset/confirm/':
      return ok({})
    case '/auth/password-reset/request/':
      return ok({ sent_to: '******3210', otp_length: 6, debug_otp: '123456' })
    case '/auth/password-reset/verify/':
      return ok({ reset_token: 'prototype' })
    case '/subscriptions/current/':
      return ok(currentSubscription())
    case '/subscriptions/payments/':
      return ok(tables.subscriptionPayments)
    case '/subscriptions/easebuzz-initiate/':
      return ok({ success: true, is_mock: true, txnid: uid('txn') })
    case '/members/due-list/':
      return ok(dueList())
    case '/members/app-usage/':
      return ok({ members: tables.members.filter((m) => m.chapter === (query.get('chapter') ?? CHAPTER)).map(usageOf) })
    case '/members/app-usage/summary/':
      return ok(usageSummary())
    case '/members/team/lookup/':
      return ok({ exists: false })
    case '/members/me/': {
      const m = memberById(signedIn().id)
      if (m) Object.assign(m, body, { profile_state: body.profile_state ?? 'saved' })
      return ok(m ?? {})
    }
    case '/members/invoices/submit-payment/':
      return pay(body, 'pending')
    case '/members/invoices/record/':
      return pay(body, 'paid')
    case '/members/invoices/verify/':
      return verify(body)
    case '/members/invoices/manual/':
      return manualInvoice(body)
    case '/members/invoices/undo-payment/':
      return undoPayment(body)
    case '/members/attendance/manual/': {
      const row: Row = { id: uid('at'), meeting: body.meeting, member: body.member, method: 'manual', marked_at: body.marked_at, distance_m: 0 }
      tables.attendance.push(row)
      return ok(row, 201)
    }
    case '/regions/visitor-qr/': {
      const chapter = chapterById(CHAPTER) as Row
      return ok({ chapter_id: chapter.id, chapter_name: chapter.name, chapter_code: chapter.code, visitor_token: VISITOR_TOKEN, registration_url: `${window.location.origin}/visitor/register?token=${VISITOR_TOKEN}`, host_name: memberById('m8')?.name ?? '', chapter_lead_name: memberById('m1')?.name ?? null, qr_data_url: '' })
    }
  }

  const pollVote = path.match(/^\/chapters\/polls\/([^/]+)\/vote\/$/)
  if (pollVote) return vote(pollVote[1], body.option_ids as string[])

  const settings = path.match(/^\/chapters\/([^/]+)\/settings\/$/)
  if (settings) {
    const chapter = chapterById(settings[1])
    if (chapter) Object.assign(chapter, body)
    return ok(chapter ?? {})
  }

  if (/^\/members\/team\/[^/]+\/reset-pin\/$/.test(path)) return ok({})
  if (/^\/subscriptions\/easebuzz-verify\//.test(path)) return ok({ status: 'success', txnid: '' })

  const activate = path.match(/^\/subscriptions\/([^/]+)\/activate\/$/)
  if (activate) {
    const s = tables.subscriptions.find((x) => x.id === activate[1])
    if (s) s.status = 'active'
    return ok({ subscription: s, created: false })
  }

  const registration = path.match(/^\/chapters\/public\/registration\/([^/]+)\/$/)
  if (registration) return registrationDetail(registration[1])

  const visitor = path.match(/^\/chapters\/public\/visitor\/([^/]+)\/(?:(check-phone|register|substitute)\/)?$/)
  if (visitor) {
    if (visitor[2] === 'check-phone') return ok({ exists: false })
    if (visitor[2] === 'register') return registerVisitor(body)
    if (visitor[2] === 'substitute') return registerSubstitute(body)
    return ok(visitorInfo())
  }

  return collection(path, method, query, body) ?? { error: 'Not available in the prototype.', status: 404 }
}

export async function demoRequest<T>(endpoint: string, options: RequestInit = {}): Promise<DemoAnswer<T>> {
  const [rawPath, rawQuery = ''] = endpoint.split('?')
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const method = (options.method ?? 'GET').toUpperCase()
  const body = typeof options.body === 'string' ? (JSON.parse(options.body) as Row) : {}
  const res = answer(path, method, new URLSearchParams(rawQuery), body)
  if (method !== 'GET') save()
  /* a copy, so the app never holds the stored rows themselves */
  return res.data === undefined ? res : { ...res, data: structuredClone(res.data) }
}
