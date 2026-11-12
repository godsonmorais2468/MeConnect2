/* ============================================================
   Browser-side data store (localStorage) with typed actions.
   Replace the bodies of these actions with API calls later; the
   pages only talk to what is exported here.
   ============================================================ */
import { useSyncExternalStore } from 'react'
import { receiptFloor, yearFor } from './vouchers'
import { designationsOf } from './designations'
import { SUPER_ADMIN, buildSeed } from '../data/seed'
import { codeValid, distanceM, phaseOf, windowOf } from './attendance'
import { dayOf, remainingOnRequest } from './dues'
import { fmtTime } from './format'
import { apiRequest, setTokens, clearTokens } from './api'
import { unlinkUser } from './oneSignal'
import { BILLING_CYCLES, PLAN_SCOPES } from './types'
import type { AccountHead, AppUsageChapter, AppUsageData, AttendanceMethod, BankMaster, Chapter, DB, Designation, DueListData, DueListMode, FinancialYear, HeadType, Invoice, Meeting, ModeOfPay, PayMethod, PaymentRequest, Plan, Poll, Profile, Recurrence, Membership, Region, Session, Substitute, Visitor, Vote, Voucher, VoucherKind } from './types'

const DB_KEY = 'me-connect:db:v17'
const SESSION_KEY = 'me-connect:session'

export interface ActionResult {
  error?: string
  /** Which form field the error belongs to, when there is one. */
  field?: string
  id?: string
}

/* ---------- persistence ---------- */

function loadDB(): DB {
  try {
    const raw = window.localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      if (parsed.regions && parsed.plans && parsed.chapters && parsed.designations && parsed.members && parsed.meetings && parsed.attendance && parsed.invoices && parsed.requestTypes && parsed.requests && parsed.polls && parsed.votes) {
        if (!parsed.accountHeads) parsed.accountHeads = []
        if (!parsed.paymentModes) parsed.paymentModes = []
        if (!parsed.financialYears) parsed.financialYears = []
        if (!parsed.bankAccounts) parsed.bankAccounts = []
        if (!parsed.vouchers) parsed.vouchers = []
        if (!parsed.visitorPayments) parsed.visitorPayments = []
        if (!parsed.substitutes) parsed.substitutes = []
        if (!parsed.visitors) parsed.visitors = []
        /* Older cached plans predate explicit scope/billing-cycle fields. */
        parsed.plans = parsed.plans.map((plan: Plan & { scope_type?: unknown; billing_cycle?: unknown; member?: string }) => ({
          ...plan,
          scopeType: planScope(plan.scopeType ?? plan.scope_type, plan.chapterId),
          billingCycle: planCycle(plan.billingCycle ?? plan.billing_cycle),
          memberId: plan.memberId || plan.member || '',
        }))
        return parsed
      }
    }
  } catch {
    /* corrupt or blocked storage — start empty */
  }
  return buildSeed()
}

function loadSession(): Session | null {
  for (const store of ['localStorage', 'sessionStorage'] as const) {
    try {
      const raw = window[store].getItem(SESSION_KEY)
      if (raw) return JSON.parse(raw) as Session
    } catch {
      /* blocked storage */
    }
  }
  return null
}

let db: DB = loadDB()
let session: Session | null = loadSession()

/* The chapters the signed-in person belongs to, kept where the sign in is kept (this device, or this tab only). */
const MEMBERSHIPS_KEY = 'me-connect:memberships'

function loadMemberships(): Membership[] {
  for (const store of ['localStorage', 'sessionStorage'] as const) {
    try {
      const raw = window[store].getItem(MEMBERSHIPS_KEY)
      if (raw) return JSON.parse(raw) as Membership[]
    } catch {
      /* blocked storage */
    }
  }
  return []
}

let memberships: Membership[] = loadMemberships()

/** Whether this sign in is remembered on the device (tokens in localStorage) rather than kept for this tab only. */
const rememberedLogin = () => {
  try {
    return window.localStorage.getItem('me-connect:tokens') !== null
  } catch {
    return false
  }
}
const listeners = new Set<() => void>()

/* How many times this browser changed the data itself, and when the backend was last read. */
let edits = 0
let lastSyncAt = 0
let syncing: Promise<void> | null = null

/** Reads everything from the backend. Calls made while a read is running share it instead of piling up. */
export function syncWithBackend(): Promise<void> {
  if (!syncing) syncing = runSync().finally(() => (syncing = null))
  return syncing
}

/** Reads again only if the last read is older than `maxAgeMs`. Used when someone comes back to the tab or opens another page. */
export function refreshIfStale(maxAgeMs = 15_000) {
  if (Date.now() - lastSyncAt > maxAgeMs) void syncWithBackend()
}

async function runSync(attempt = 0): Promise<void> {
  const mark = edits
  try {
    const [regionsRes, plansRes, chaptersRes, meetingsRes, pollsRes, membersRes, invoicesRes, attendanceRes, designationsRes, accountHeadsRes, paymentModesRes, financialYearsRes, bankAccountsRes, vouchersRes, visitorPaymentsRes, paymentRequestsRes, membershipsRes, substituteRegsRes, visitorRegsRes] = await Promise.all([
      apiRequest<any[]>('/regions/'),
      apiRequest<any[]>('/masters/plans/'),
      apiRequest<any[]>('/chapters/'),
      apiRequest<any[]>('/chapters/meetings/'),
      apiRequest<any[]>('/chapters/polls/'),
      apiRequest<any[]>('/members/'),
      apiRequest<any[]>('/members/invoices/'),
      apiRequest<any[]>('/members/attendance/'),
      apiRequest<any[]>('/masters/designations/'),
      apiRequest<any[]>('/masters/account-heads/'),
      apiRequest<any[]>('/masters/payment-modes/'),
      apiRequest<any[]>('/masters/financial-years/'),
      apiRequest<any[]>('/masters/bank-accounts/'),
      apiRequest<any[]>('/masters/vouchers/'),
      apiRequest<any[]>('/members/visitor-payments/'),
      apiRequest<any[]>('/members/payment-requests/'),
      apiRequest<any>('/auth/memberships/'),
      apiRequest<any[]>('/members/substitute-registrations/'),
      apiRequest<any[]>('/members/visitor-registrations/'),
    ])

    let updated = false
    const next = { ...db }

    /* Another chapter may have added this person since they signed in. */
    if (membershipsRes.data && Array.isArray(membershipsRes.data.memberships)) saveMemberships(membershipsRes.data.memberships.map(toMembership), rememberedLogin())

    if (regionsRes.data && Array.isArray(regionsRes.data)) {
      next.regions = regionsRes.data.map((r: any) => ({
        id: r.id,
        code: r.code || '',
        name: r.name,
        adminName: r.admin_name,
        adminMobile: r.admin_mobile,
        email: r.email || '',
        adminPin: r.admin_pin || '',
        subscriptionStartDate: r.subscription_start_date || '',
        subscriptionEndDate: r.subscription_end_date || '',
        subscriptionGrandfathered: r.subscription_grandfathered !== undefined ? Boolean(r.subscription_grandfathered) : true,
        maxChapters: r.max_chapters != null ? Number(r.max_chapters) : 0,
        isActive: r.is_active !== undefined ? Boolean(r.is_active) : true,
        createdAt: r.created_at || new Date().toISOString()
      }))
      updated = true
    }

    if (plansRes.data && Array.isArray(plansRes.data)) {
      next.plans = plansRes.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        scopeType: planScope(p.scope_type, p.chapter),
        billingCycle: planCycle(p.billing_cycle),
        rate: Number(p.rate),
        taxPercent: Number(p.tax_percent),
        regionId: p.region || '',
        applicableRegions: p.applicable_regions || (p.region ? [p.region] : []),
        applicableRegionNames: p.applicable_region_names || (p.region_name ? [p.region_name] : []),
        chapterId: p.chapter || '',
        memberId: p.member || '',
        canDelete: p.can_delete !== undefined ? Boolean(p.can_delete) : true,
      }))
      updated = true
    }

    if (chaptersRes.data && Array.isArray(chaptersRes.data)) {
      next.chapters = chaptersRes.data.map((c: any) => ({
        id: c.id,
        regionId: c.region,
        code: c.code || '',
        name: c.name,
        city: c.city || '',
        logo: c.logo || '',
        logoName: c.logo_name || '',
        description: c.description || '',
        isActive: c.is_active !== undefined ? Boolean(c.is_active) : true,
        upiId: c.upi_id || '',
        upiName: c.upi_name || '',
        dueListEnabled: Boolean(c.due_list_enabled),
        dueListMode: c.due_list_mode === 'due_date' ? 'due_date' : 'default',
        createdAt: c.created_at || new Date().toISOString()
      }))
      updated = true
    }

    if (meetingsRes.data && Array.isArray(meetingsRes.data)) {
      next.meetings = meetingsRes.data.map((m: any) => ({
        id: m.id,
        regionId: m.region,
        chapterId: m.chapter,
        title: m.title,
        mode: m.mode,
        startsAt: m.starts_at,
        durationMin: m.duration_min,
        venue: m.venue || '',
        lat: m.lat ? Number(m.lat) : null,
        lng: m.lng ? Number(m.lng) : null,
        radiusM: m.radius_m || 150,
        audience: m.audience || 'all',
        audienceDesignations: m.audience_designations || [],
        inviteeIds: (m.invitees || []).map(String),
        invitedIds: (m.invited_ids || []).map(String),
        createdAt: m.created_at || new Date().toISOString()
      }))
      updated = true
    }

    if (pollsRes.data && Array.isArray(pollsRes.data)) {
      next.polls = pollsRes.data.map(toPoll)
      next.votes = pollsRes.data.flatMap(toVotes)
      updated = true
    }

    if (membersRes.data && Array.isArray(membersRes.data)) {
      next.members = membersRes.data.map((m: any) => ({
        id: m.id,
        regionId: m.region,
        chapterId: m.chapter,
        planId: m.plan || '',
        mode: m.mode,
        amount: Number(m.amount),
        designation: m.designation,
        name: m.name,
        mobile: m.mobile,
        pin: '',
        organisation: m.organisation || '',
        category: m.category || '',
        photo: m.photo || '',
        isActive: m.is_active !== undefined ? Boolean(m.is_active) : true,
        loginEnabled: m.login_enabled !== false,
        homeChapterName: m.home_chapter_name || '',
        createdAt: m.created_at || new Date().toISOString(),
        profile: {
          email: m.email || '',
          website: m.website || '',
          social: m.social || '',
          dob: m.dob || '',
          married: m.married || '',
          anniversary: m.anniversary || '',
          dateOfJoining: m.date_of_joining || '',
          spouse: m.spouse || '',
        },
        profileState: m.profile_state,
      }))
      updated = true
    }

    if (invoicesRes.data && Array.isArray(invoicesRes.data)) {
      next.invoices = invoicesRes.data.map(toInvoice)
      updated = true
    }

    /* Only the head table can read payment requests; for everyone else the list is simply empty. */
    if (paymentRequestsRes.data && Array.isArray(paymentRequestsRes.data)) {
      next.requests = paymentRequestsRes.data.map(toRequest)
      updated = true
    } else if (paymentRequestsRes.status === 403) {
      next.requests = []
      updated = true
    }

    /* Substitutes and visitors registered through the chapter's QR page: only the head table, region admin and super admin may read them. */
    if (substituteRegsRes.data && Array.isArray(substituteRegsRes.data)) {
      next.substitutes = substituteRegsRes.data.map((s: { id: string; chapter: string; meeting: string; member: string; substitute_name: string; substitute_phone: string; created_at: string }) => ({
        id: s.id,
        chapterId: s.chapter,
        meetingId: s.meeting,
        memberId: s.member,
        substituteName: s.substitute_name,
        substitutePhone: s.substitute_phone,
        createdAt: s.created_at,
      }))
      updated = true
    }
    if (visitorRegsRes.data && Array.isArray(visitorRegsRes.data)) {
      next.visitors = visitorRegsRes.data.map((v: { id: string; chapter: string; meeting: string | null; referred_by: string | null; visitor_name: string; visitor_phone: string; created_at: string }) => ({
        id: v.id,
        chapterId: v.chapter,
        meetingId: v.meeting ?? '',
        invitedById: v.referred_by || undefined,
        name: v.visitor_name,
        company: '',
        phone: v.visitor_phone,
        createdAt: v.created_at,
      }))
      updated = true
    }

    if (attendanceRes.data && Array.isArray(attendanceRes.data)) {
      next.attendance = attendanceRes.data.map((a: any) => ({
        id: a.id,
        meetingId: a.meeting,
        memberId: a.member ?? String(a.user),
        method: a.method,
        at: a.marked_at,
        distanceM: a.distance_m != null ? Math.round(a.distance_m) : undefined,
      }))
      updated = true
    }

    if (designationsRes.data && Array.isArray(designationsRes.data)) {
      next.designations = designationsRes.data.map((d: any) => ({
        id: d.id,
        regionId: d.region ?? '',
        name: d.name,
        description: d.description || '',
        isHeadTable: Boolean(d.is_head_table),
        isLeadershipTeam: Boolean(d.is_leadership_team),
        multiChapterLogin: Boolean(d.multi_chapter_login),
        multiChapterAddOnly: Boolean(d.multi_chapter_add_only),
        permissions: Array.isArray(d.permissions) ? d.permissions : [],
        isActive: d.is_active !== undefined ? Boolean(d.is_active) : true,
        chapterId: d.chapter ?? '',
        sourceId: d.source ?? '',
        hidden: Boolean(d.is_hidden),
        createdAt: d.created_at || new Date().toISOString(),
      }))
      updated = true
    }

    if (accountHeadsRes.data && Array.isArray(accountHeadsRes.data)) {
      next.accountHeads = accountHeadsRes.data.map((h: any) => ({
        id: h.id,
        regionId: h.region ?? '',
        chapterId: h.chapter ?? '',
        headType: h.head_type,
        name: h.name,
        comment: h.comment || '',
        isActive: h.is_active !== undefined ? Boolean(h.is_active) : true,
        createdAt: h.created_at || new Date().toISOString(),
        updatedAt: h.updated_at || new Date().toISOString(),
      }))
      updated = true
    }

    if (paymentModesRes.data && Array.isArray(paymentModesRes.data)) {
      next.paymentModes = paymentModesRes.data.map((m: any) => ({
        id: m.id,
        regionId: m.region,
        chapterId: m.chapter,
        name: m.name,
        code: m.code || '',
        description: m.description || '',
        isActive: m.is_active !== undefined ? Boolean(m.is_active) : true,
        createdAt: m.created_at || new Date().toISOString(),
        updatedAt: m.updated_at || new Date().toISOString(),
      }))
      updated = true
    }

    if (financialYearsRes.data && Array.isArray(financialYearsRes.data)) {
      next.financialYears = financialYearsRes.data.map((f: any) => ({
        id: f.id,
        regionId: f.region,
        chapterId: f.chapter,
        title: f.title,
        startDate: f.start_date,
        endDate: f.end_date,
        billStartNumber: Number(f.bill_start_number) || 1,
        invoicePrefix: f.invoice_prefix || 'INV',
        invoiceStartNumber: Number(f.invoice_start_number) || 1,
        receiptPrefix: f.receipt_prefix || 'REC',
        receiptStartNumber: Number(f.receipt_start_number) || 1,
        voucherPrefix: f.voucher_prefix || 'VOU',
        voucherStartNumber: Number(f.voucher_start_number) || 1,
        isCurrent: Boolean(f.is_current),
        isLocked: Boolean(f.is_locked),
        createdAt: f.created_at || new Date().toISOString(),
        updatedAt: f.updated_at || new Date().toISOString(),
      }))
      updated = true
    }

    if (bankAccountsRes.data && Array.isArray(bankAccountsRes.data)) {
      next.bankAccounts = bankAccountsRes.data.map((b: any) => ({
        id: b.id,
        regionId: b.region,
        chapterId: b.chapter,
        bankName: b.bank_name,
        accountName: b.account_name,
        accountNumber: b.account_number,
        ifscCode: b.ifsc_code || '',
        branch: b.branch || '',
        upiId: b.upi_id || '',
        openingBalance: Number(b.opening_balance) || 0,
        isDefault: Boolean(b.is_default),
        isActive: b.is_active !== undefined ? Boolean(b.is_active) : true,
        createdAt: b.created_at || new Date().toISOString(),
        updatedAt: b.updated_at || new Date().toISOString(),
      }))
      updated = true
    }

    /* Only the head table, region admin and super admin may read vouchers: for anyone else this answers with an error and is skipped. */
    if (vouchersRes.data && Array.isArray(vouchersRes.data)) {
      next.vouchers = vouchersRes.data.map(toVoucher)
      updated = true
    }

    /* Fees visitors paid when registering: only the head table, region admin and super admin may read them, others get an error and skip this. */
    if (visitorPaymentsRes.data && Array.isArray(visitorPaymentsRes.data)) {
      next.visitorPayments = visitorPaymentsRes.data.map((v: any) => ({
        id: v.id,
        chapterId: v.chapter,
        visitorName: v.visitor_name,
        visitorPhone: v.visitor_phone,
        referredByName: v.referred_by_name || '',
        mode: v.payment_mode,
        amount: Number(v.payment_amount),
        receipt: v.payment_receipt,
        paidAt: v.paid_at,
        reference: v.reference,
      }))
      updated = true
    }

    /* Something was changed here while the answer was on its way: what came back may be older than that change, so read again. */
    if (edits !== mark) {
      if (attempt < 1) return runSync(attempt + 1)
      return
    }

    if (updated) {
      commit(next)
    }
    lastSyncAt = Date.now()
  } catch (err) {
    console.error('Failed to sync with backend:', err)
  }
}

// Automatically sync on initial load
if (typeof window !== 'undefined') {
  syncWithBackend()
}

function emit() {
  listeners.forEach((l) => l())
}

function commit(next: DB) {
  db = next
  edits++
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    /* storage full or blocked — the change still lives for this tab */
  }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useDB = () => useSyncExternalStore(subscribe, () => db)
export const useSession = () => useSyncExternalStore(subscribe, () => session)
export const useMemberships = () => useSyncExternalStore(subscribe, () => memberships)
export const getDB = () => db
export const getSession = () => session

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const iso = () => new Date().toISOString()

/* ---------- helpers ---------- */

export const isMobile = (v: string) => /^\d{10}$/.test(v)
export const isPin = (v: string) => /^\d{4}$/.test(v)

/** Legacy responses without a scope fall back to the old region/chapter shape. */
function planScope(value: unknown, chapterId: unknown): Plan['scopeType'] {
  return typeof value === 'string' && (PLAN_SCOPES as readonly string[]).includes(value)
    ? (value as Plan['scopeType'])
    : chapterId
      ? 'chapter'
      : 'region'
}

/** Legacy plans were monthly; missing or unknown cycles must keep behaving as monthly. */
function planCycle(value: unknown): Plan['billingCycle'] {
  return typeof value === 'string' && (BILLING_CYCLES as readonly string[]).includes(value)
    ? (value as Plan['billingCycle'])
    : 'monthly'
}

function mobileTaken(mobile: string, exceptMemberId?: string) {
  return (
    mobile === SUPER_ADMIN.mobile ||
    db.regions.some((r) => r.adminMobile === mobile) ||
    db.members.some((m) => m.mobile === mobile && m.id !== exceptMemberId)
  )
}

/* ---------- session ---------- */

/** `setPin` is returned instead of a session when the person is still on the PIN the region admin gave them. */
export interface SignInResult {
  session?: Session
  error?: string
  setPin?: { token: string; name: string }
  /** The person belongs to more than one chapter: they pick one (chooseChapter) before getting in. */
  choose?: { name: string; memberships: Membership[] }
}

export async function signIn(mobile: string, pin: string, remember: boolean): Promise<SignInResult> {
  try {
    const res = await apiRequest<{
      user: { id: string; name: string; mobile: string; role: Session['role'] }
      tokens: { access: string; refresh: string }
      memberships?: any[]
      must_change_pin?: boolean
      pin_token?: string
    }>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ mobile, pin }),
    })

    if (res.error) {
      return { error: res.error }
    }

    if (res.data?.must_change_pin && res.data.pin_token) {
      return { setPin: { token: res.data.pin_token, name: res.data.user?.name ?? '' } }
    }

    if (res.data?.user && res.data?.tokens) {
      const u = res.data.user
      let sessionId = u.id
      if (u.role === 'region_admin' && (u as any).region_id) {
        sessionId = (u as any).region_id
      } else if (u.role === 'member' && (u as any).member_id) {
        sessionId = (u as any).member_id
      }

      const found: Session = {
        role: u.role,
        id: sessionId,
      }
      setTokens(res.data.tokens, remember)
      const list = (res.data.memberships || []).map(toMembership)
      if (u.role === 'member' && list.length > 1) {
        /* more than one chapter: nobody is signed in until one is chosen */
        saveMemberships(list, remember)
        return { choose: { name: u.name, memberships: list } }
      }
      saveMemberships(list, remember)
      session = found

      try {
        window.sessionStorage.removeItem(SESSION_KEY)
        window.localStorage.removeItem(SESSION_KEY)
        window[remember ? 'localStorage' : 'sessionStorage'].setItem(SESSION_KEY, JSON.stringify(found))
      } catch {}

      await syncWithBackend()
      emit()
      return { session: found }
    }
  } catch (err) {
    console.warn('Backend login attempt failed, checking local:', err)
  }

  // Fallback to local session (e.g. offline dev fallback)
  let found: Session | null = null
  if (mobile === SUPER_ADMIN.mobile && pin === SUPER_ADMIN.pin) {
    found = { role: 'super_admin', id: SUPER_ADMIN.id }
  } else {
    const region = db.regions.find((r) => r.adminMobile === mobile && r.adminPin === pin)
    if (region) {
      if (region.isActive === false) {
        return { error: `Region '${region.name}' is currently inactive. Contact Super Admin.` }
      }
      found = { role: 'region_admin', id: region.id }
    } else {
      const member = db.members.find((m) => m.mobile === mobile && m.pin === pin)
      if (member) found = { role: 'member', id: member.id }
    }
  }
  if (!found) {
    return { error: 'Invalid mobile number or PIN.' }
  }

  session = found
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
    window.localStorage.removeItem(SESSION_KEY)
    window[remember ? 'localStorage' : 'sessionStorage'].setItem(SESSION_KEY, JSON.stringify(found))
  } catch {}
  emit()
  return { session: found }
}

export function signOut() {
  clearTokens()
  /* Stop this device receiving the signed-out user's push notifications. */
  void unlinkUser()
  session = null
  memberships = []
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
    window.localStorage.removeItem(SESSION_KEY)
    window.sessionStorage.removeItem(MEMBERSHIPS_KEY)
    window.localStorage.removeItem(MEMBERSHIPS_KEY)
  } catch {}
  emit()
}

/**
 * Opens one of the chapters a person belongs to. The server gives tokens that act in that chapter, so everything that
 * follows (dues, attendance, what the head table can do) is that chapter's. The PIN is not asked again.
 */
export async function chooseChapter(memberId: string, remember: boolean): Promise<ActionResult> {
  const res = await apiRequest<any>('/auth/switch-chapter/', { method: 'POST', body: JSON.stringify({ member_id: memberId }) })
  if (res.error || !res.data?.tokens) return { error: res.error || 'Could not open that chapter.' }
  setTokens(res.data.tokens, remember)
  /* read the new chapter's data before showing it, so nothing of the old one is left on screen */
  if (syncing) await syncing.catch(() => undefined)
  await syncWithBackend()
  session = { role: 'member', id: memberId }
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
    window.localStorage.removeItem(SESSION_KEY)
    window[remember ? 'localStorage' : 'sessionStorage'].setItem(SESSION_KEY, JSON.stringify(session))
  } catch {}
  saveMemberships((res.data.memberships || []).map(toMembership), remember)
  return {}
}

/** Moves to another of the person's chapters while signed in. */
export const switchChapter = (memberId: string) => chooseChapter(memberId, rememberedLogin())

export function resetDemo() {
  signOut()
  commit(buildSeed())
}

/* ---------- super admin ---------- */

export async function createRegion(input: {
  code: string
  name: string
  adminName: string
  adminMobile: string
  email: string
  adminPin: string
  subscriptionStartDate?: string
  subscriptionEndDate?: string
  subscriptionGrandfathered?: boolean
  maxChapters?: number
  isActive?: boolean
}): Promise<ActionResult> {
  const name = input.name.trim()
  const code = input.code.trim().toUpperCase()
  if (db.regions.some((r) => r.code && r.code.toUpperCase() === code)) return { field: 'code', error: 'A region with this code already exists.' }
  if (db.regions.some((r) => r.name.toLowerCase() === name.toLowerCase())) return { field: 'name', error: 'A region with this name already exists.' }
  if (mobileTaken(input.adminMobile)) return { field: 'adminMobile', error: 'This mobile number is already registered.' }

  const payload: any = {
    code,
    name,
    admin_name: input.adminName.trim(),
    admin_mobile: input.adminMobile,
    email: input.email.trim(),
    admin_pin: input.adminPin,
    subscription_start_date: input.subscriptionStartDate || null,
    subscription_end_date: input.subscriptionEndDate || null,
    subscription_grandfathered: input.subscriptionGrandfathered === true,
    max_chapters: input.maxChapters != null ? input.maxChapters : 0,
    is_active: input.isActive !== undefined ? input.isActive : true,
  }

  const res = await apiRequest<any>('/regions/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (res.error) {
    return { error: res.error }
  }

  const region: Region = {
    id: res.data?.id || uid('rg'),
    code,
    name,
    adminName: input.adminName.trim(),
    adminMobile: input.adminMobile,
    email: input.email.trim(),
    adminPin: input.adminPin,
    subscriptionStartDate: input.subscriptionStartDate || '',
    subscriptionEndDate: input.subscriptionEndDate || '',
    subscriptionGrandfathered: input.subscriptionGrandfathered === true,
    maxChapters: input.maxChapters != null ? input.maxChapters : 0,
    isActive: input.isActive !== undefined ? input.isActive : true,
    createdAt: res.data?.created_at || iso(),
  }
  commit({ ...db, regions: [...db.regions, region] })
  return { id: region.id }
}

export async function updateRegion(
  id: string,
  input: {
    code?: string
    name: string
    adminName: string
    adminMobile: string
    email?: string
    adminPin?: string
    subscriptionStartDate?: string
    subscriptionEndDate?: string
    subscriptionGrandfathered?: boolean
    maxChapters?: number
    isActive?: boolean
  },
): Promise<ActionResult> {
  const name = input.name.trim()
  const code = (input.code ?? '').trim().toUpperCase()
  if (code && db.regions.some((r) => r.id !== id && r.code && r.code.toUpperCase() === code)) {
    return { field: 'code', error: 'A region with this code already exists.' }
  }
  if (db.regions.some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase())) {
    return { field: 'name', error: 'A region with this name already exists.' }
  }

  const payload: any = {
    name,
    admin_name: input.adminName.trim(),
    admin_mobile: input.adminMobile,
    subscription_start_date: input.subscriptionStartDate || null,
    subscription_end_date: input.subscriptionEndDate || null,
    subscription_grandfathered: input.subscriptionGrandfathered === true,
    max_chapters: input.maxChapters != null ? input.maxChapters : 0,
    is_active: input.isActive !== undefined ? input.isActive : true,
  }
  if (code) payload.code = code
  if (input.email) payload.email = input.email.trim()
  if (input.adminPin) {
    payload.admin_pin = input.adminPin
  }

  const res = await apiRequest<any>(`/regions/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  if (res.error) {
    return { error: res.error }
  }

  commit({
    ...db,
    regions: db.regions.map((r) =>
      r.id === id
        ? {
            ...r,
            name,
            code: code || r.code,
            email: input.email ? input.email.trim() : r.email,
            adminName: input.adminName.trim(),
            adminMobile: input.adminMobile,
            adminPin: input.adminPin || r.adminPin,
            subscriptionStartDate: input.subscriptionStartDate !== undefined ? input.subscriptionStartDate : r.subscriptionStartDate,
            subscriptionEndDate: input.subscriptionEndDate !== undefined ? input.subscriptionEndDate : r.subscriptionEndDate,
            subscriptionGrandfathered: input.subscriptionGrandfathered !== undefined ? input.subscriptionGrandfathered : r.subscriptionGrandfathered,
            maxChapters: input.maxChapters !== undefined ? input.maxChapters : r.maxChapters,
            isActive: input.isActive !== undefined ? input.isActive : r.isActive,
          }
        : r,
    ),
  })
  return { id }
}

export async function deleteRegion(id: string): Promise<ActionResult> {
  const res = await apiRequest(`/regions/${id}/`, { method: 'DELETE' })
  if (res.error) return { error: res.error }

  commit({
    ...db,
    regions: db.regions.filter((r) => r.id !== id),
    chapters: db.chapters.filter((c) => c.regionId !== id),
  })
  return { id }
}

export interface CreatePlanInput extends Omit<Plan, 'id'> {
  assignAllRegions?: boolean
  assignRegionIds?: string[]
  idempotencyKey?: string
}

export async function createPlan(input: CreatePlanInput): Promise<ActionResult> {
  const name = input.name.trim()
  const { assignAllRegions, assignRegionIds, idempotencyKey, ...planInput } = input
  if (db.plans.some((p) => p.name.toLowerCase() === name.toLowerCase())) return { field: 'name', error: 'A plan with this name already exists.' }

  const regionAssignment =
    planInput.scopeType === 'region'
      ? {
          assign_all_regions: Boolean(assignAllRegions),
          assign_regions: assignRegionIds ?? [],
        }
      : {}

  const res = await apiRequest<any>('/masters/plans/', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description: planInput.description.trim(),
      scope_type: planInput.scopeType,
      billing_cycle: planInput.billingCycle,
      rate: planInput.rate,
      tax_percent: planInput.taxPercent,
      region: planInput.regionId || null,
      chapter: planInput.scopeType === 'region' ? null : planInput.chapterId || null,
      member: planInput.scopeType === 'member' ? planInput.memberId || null : null,
      ...regionAssignment,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    }),
  })

  if (res.error) {
    return { error: res.error }
  }

  const plan: Plan = {
    ...planInput,
    name,
    description: planInput.description.trim(),
    id: res.data?.id || uid('pl'),
    canDelete: true,
    applicableRegions: res.data?.applicable_regions || (planInput.scopeType === 'region' ? (assignAllRegions ? db.regions.map(r => r.id) : (assignRegionIds ?? [])) : []),
    applicableRegionNames: res.data?.applicable_region_names || [],
  }
  commit({ ...db, plans: [...db.plans, plan] })
  return { id: plan.id }
}

export interface UpdatePlanAssignment {
  assignAllRegions?: boolean
  assignRegionIds?: string[]
}

export async function updatePlan(
  id: string,
  input: Omit<Plan, 'id'>,
  regionAssignment?: UpdatePlanAssignment
): Promise<ActionResult> {
  const name = input.name.trim()
  if (db.plans.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) return { field: 'name', error: 'A plan with this name already exists.' }

  const assignAll = regionAssignment?.assignAllRegions
  const assignIds = regionAssignment?.assignRegionIds
  const assignmentPayload =
    input.scopeType === 'region' && (assignAll !== undefined || assignIds !== undefined)
      ? {
          assign_all_regions: Boolean(assignAll),
          assign_regions: assignIds ?? [],
        }
      : {}

  const res = await apiRequest<any>(`/masters/plans/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      name,
      description: input.description.trim(),
      scope_type: input.scopeType,
      billing_cycle: input.billingCycle,
      rate: input.rate,
      tax_percent: input.taxPercent,
      region: input.regionId || null,
      chapter: input.scopeType === 'region' ? null : input.chapterId || null,
      member: input.scopeType === 'member' ? input.memberId || null : null,
      ...assignmentPayload,
    }),
  })

  if (res.error) {
    return { error: res.error }
  }

  const updatedPlan: Plan = {
    ...input,
    id,
    name,
    description: input.description.trim(),
    applicableRegions: res.data?.applicable_regions || (input.scopeType === 'region' ? (assignAll ? db.regions.map(r => r.id) : (assignIds ?? input.applicableRegions ?? [])) : []),
    applicableRegionNames: res.data?.applicable_region_names || input.applicableRegionNames || [],
  }

  commit({ ...db, plans: db.plans.map((p) => (p.id === id ? { ...p, ...updatedPlan } : p)) })
  return { id }
}

export async function deletePlan(id: string): Promise<ActionResult> {
  const target = db.plans.find((p) => p.id === id)
  if (target && target.canDelete === false) {
    return { error: `Cannot delete plan '${target.name}' because an active subscription or verified payment exists.` }
  }

  const res = await apiRequest(`/masters/plans/${id}/`, { method: 'DELETE' })
  if (res.error) return { error: res.error }

  commit({ ...db, plans: db.plans.filter((p) => p.id !== id) })
  return { id }
}

/* ---------- region admin ---------- */

export async function createChapter(
  regionId: string,
  input: { code: string; name: string; logo?: string; logoName?: string; description?: string; isActive?: boolean },
): Promise<ActionResult> {
  const name = input.name.trim()
  const code = input.code.trim().toUpperCase()
  const targetRegion = db.regions.find((r) => r.id === regionId)
  if (targetRegion?.maxChapters && targetRegion.maxChapters > 0) {
    const count = db.chapters.filter((c) => c.regionId === regionId).length
    if (count >= targetRegion.maxChapters) {
      return { error: `Chapter limit reached for this region (maximum ${targetRegion.maxChapters} chapters allowed).` }
    }
  }

  if (db.chapters.some((c) => c.regionId === regionId && c.code && c.code.toUpperCase() === code)) {
    return { field: 'code', error: 'This region already has a chapter with this code.' }
  }
  if (db.chapters.some((c) => c.regionId === regionId && c.name.toLowerCase() === name.toLowerCase())) {
    return { field: 'name', error: 'This region already has a chapter with this name.' }
  }

  const res = await apiRequest<any>('/chapters/', {
    method: 'POST',
    body: JSON.stringify({
      region: regionId,
      code,
      name,
      logo: input.logo || '',
      logo_name: input.logo ? input.logoName || '' : '',
      description: (input.description || '').trim(),
      is_active: input.isActive !== undefined ? input.isActive : true,
    }),
  })

  if (res.error) return { error: res.error }

  const chapter: Chapter = {
    id: res.data?.id || uid('ch'),
    regionId,
    code,
    name,
    city: '',
    logo: input.logo || '',
    logoName: input.logo ? input.logoName || '' : '',
    description: (input.description || '').trim(),
    isActive: input.isActive !== undefined ? input.isActive : true,
    createdAt: res.data?.created_at || iso(),
  }
  commit({ ...db, chapters: [...db.chapters, chapter] })
  return { id: chapter.id }
}

/** Changes a chapter's code, name, logo, description or active state. */
export async function updateChapter(
  id: string,
  input: { code: string; name: string; logo?: string; logoName?: string; description?: string; isActive?: boolean },
): Promise<ActionResult> {
  const current = db.chapters.find((c) => c.id === id)
  if (!current) return { error: 'Chapter not found.' }
  const name = input.name.trim()
  const code = input.code.trim().toUpperCase()
  if (db.chapters.some((c) => c.id !== id && c.regionId === current.regionId && c.code && c.code.toUpperCase() === code)) {
    return { field: 'code', error: 'This region already has a chapter with this code.' }
  }
  if (db.chapters.some((c) => c.id !== id && c.regionId === current.regionId && c.name.toLowerCase() === name.toLowerCase())) {
    return { field: 'name', error: 'This region already has a chapter with this name.' }
  }

  const res = await apiRequest<any>(`/chapters/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      code,
      name,
      logo: input.logo || '',
      logo_name: input.logo ? input.logoName || '' : '',
      description: (input.description || '').trim(),
      is_active: input.isActive !== undefined ? input.isActive : true,
    }),
  })
  if (res.error) return { error: res.error }

  commit({
    ...db,
    chapters: db.chapters.map((c) =>
      c.id === id
        ? { ...c, code, name, logo: input.logo || '', logoName: input.logo ? input.logoName || '' : '', description: (input.description || '').trim(), isActive: input.isActive !== undefined ? input.isActive : true }
        : c,
    ),
  })
  return { id }
}

/* ---------- chapter team ---------- */

export interface TeamInput {
  chapterId: string
  designation: string
  name: string
  photo?: string
  organisation?: string
  mobile: string
  email?: string
  pin?: string
  isActive?: boolean
  /** The number already belongs to a member of another chapter: they are added here with their own login and PIN. */
  joinExisting?: boolean
}

function teamPayload(i: TeamInput) {
  return {
    chapter: i.chapterId,
    designation: i.designation,
    name: i.name.trim(),
    photo: i.photo || '',
    organisation: (i.organisation || '').trim(),
    mobile: i.mobile,
    email: (i.email || '').trim(),
    is_active: i.isActive !== false,
    ...(i.pin ? { pin: i.pin } : {}),
  }
}

/** A refused designation is shown under the Designation field; anything else stays a general error. */
function teamError(res: { error?: string; data?: any }): ActionResult {
  const designation = res.data?.designation
  if (Array.isArray(designation) && typeof designation[0] === 'string') return { field: 'designation', error: designation[0] }
  return { error: res.error }
}

/** Adds a person to a chapter's team: a login plus a member record with no plan and no dues. */
export async function createTeamMember(input: TeamInput): Promise<ActionResult> {
  if (!input.joinExisting && mobileTaken(input.mobile)) return { field: 'mobile', error: 'This phone number is already registered.' }
  const res = await apiRequest<any>('/members/team/', { method: 'POST', body: JSON.stringify(teamPayload(input)) })
  if (res.error) return teamError(res)
  await syncWithBackend()
  return { id: res.data?.id }
}

/** Whether a mobile number already belongs to a member (of any chapter), so the form can offer to add them to this one. */
export async function lookupTeamMobile(
  mobile: string,
  chapterId: string,
): Promise<{ exists: boolean; name?: string; alreadyInChapter?: boolean; mode?: 'login' | 'listed' | 'none'; homeChapter?: string }> {
  const res = await apiRequest<any>(`/members/team/lookup/?mobile=${encodeURIComponent(mobile)}&chapter=${encodeURIComponent(chapterId)}`)
  if (res.error || !res.data?.exists) return { exists: false }
  return { exists: true, name: res.data.name, alreadyInChapter: Boolean(res.data.already_in_chapter), mode: res.data.mode, homeChapter: res.data.home_chapter || '' }
}

export async function updateTeamMember(id: string, input: TeamInput): Promise<ActionResult> {
  if (mobileTaken(input.mobile, id)) return { field: 'mobile', error: 'This phone number is already registered.' }
  const res = await apiRequest<any>(`/members/team/${id}/`, { method: 'PATCH', body: JSON.stringify(teamPayload(input)) })
  if (res.error) return teamError(res)
  await syncWithBackend()
  return { id }
}

export async function deleteTeamMember(id: string): Promise<ActionResult> {
  const res = await apiRequest<any>(`/members/team/${id}/`, { method: 'DELETE' })
  if (res.error) return { error: res.error }
  commit({ ...db, members: db.members.filter((m) => m.id !== id) })
  return { id }
}

/** Puts a team member's password back to the default (1234). They pick their own MPIN at the next login. */
export async function resetTeamMemberPin(id: string): Promise<ActionResult> {
  const res = await apiRequest<any>(`/members/team/${id}/reset-pin/`, { method: 'POST' })
  return res.error ? { error: res.error } : { id }
}

/* ---------- vouchers (payment = expense, receipt = income) ---------- */

export interface VoucherInput {
  chapterId: string
  kind: VoucherKind
  date: string
  headId: string
  amount: number
  modeName: string
  remarks: string
}

/** Turns the server's answer to a refused voucher into { field, error } for the form. */
function voucherError(res: { error?: string; data?: any }): ActionResult {
  const first = res.data && typeof res.data === 'object' ? Object.entries(res.data as Record<string, unknown>)[0] : undefined
  const names: Record<string, string> = { head: 'headId', mode_name: 'modeName', remarks: 'remarks', date: 'date', amount: 'amount' }
  if (first && Array.isArray(first[1]) && typeof first[1][0] === 'string') return { field: names[first[0]] ?? 'form', error: first[1][0] }
  return { error: res.error }
}

/** Records a voucher. The server picks the financial year from the date and assigns the number from its settings. */
export async function createVoucher(input: VoucherInput): Promise<ActionResult> {
  const year = yearFor(db, input.chapterId, input.date)
  /* receipt vouchers continue the receipt numbers members' payments have used, so tell the server how far those have got */
  const floor = input.kind === 'receipt' && year ? receiptFloor(db, input.chapterId, year.receiptPrefix || 'REC') : 0
  const res = await apiRequest<any>('/masters/vouchers/', {
    method: 'POST',
    body: JSON.stringify({ chapter: input.chapterId, kind: input.kind, date: input.date, head: input.headId, amount: input.amount.toFixed(2), mode_name: input.modeName, remarks: input.remarks, receipt_floor: floor }),
  })
  if (res.error) return voucherError(res)
  commit({ ...db, vouchers: [toVoucher(res.data), ...(db.vouchers || [])] })
  return { id: res.data?.id }
}

/** Changes a voucher's date (inside the same financial year), head, amount, mode of pay or remarks. The number never changes. */
export async function updateVoucher(id: string, input: Omit<VoucherInput, 'chapterId' | 'kind'>): Promise<ActionResult> {
  const res = await apiRequest<any>(`/masters/vouchers/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ date: input.date, head: input.headId, amount: input.amount.toFixed(2), mode_name: input.modeName, remarks: input.remarks }),
  })
  if (res.error) return voucherError(res)
  commit({ ...db, vouchers: (db.vouchers || []).map((v) => (v.id === id ? toVoucher(res.data) : v)) })
  return { id }
}

export async function deleteVoucher(id: string): Promise<ActionResult> {
  const res = await apiRequest<any>(`/masters/vouchers/${id}/`, { method: 'DELETE' })
  if (res.error) return { error: res.error }
  commit({ ...db, vouchers: (db.vouchers || []).filter((v) => v.id !== id) })
  return { id }
}

/* ---------- designations ---------- */

export interface DesignationInput {
  name: string
  description?: string
  isHeadTable?: boolean
  isLeadershipTeam?: boolean
  multiChapterLogin?: boolean
  multiChapterAddOnly?: boolean
  permissions?: string[]
  isActive?: boolean
}

function designationPayload(input: DesignationInput) {
  return {
    name: input.name.trim(),
    description: (input.description || '').trim(),
    is_head_table: Boolean(input.isHeadTable),
    is_leadership_team: Boolean(input.isLeadershipTeam),
    multi_chapter_login: Boolean(input.multiChapterLogin),
    multi_chapter_add_only: Boolean(input.multiChapterAddOnly),
    permissions: Array.isArray(input.permissions) ? input.permissions : [],
    is_active: input.isActive !== undefined ? input.isActive : true,
  }
}

/** Why a designation name cannot be used in a region (or among the defaults when `regionId` is empty), or null. */
function designationClash(regionId: string, name: string, ignoreId = '', sourceId = '', chapterId = ''): string | null {
  if (chapterId) {
    /* a chapter cannot repeat a designation it already has from its region or the defaults, or one of its own */
    const have = designationsOf(db, regionId, chapterId).some((d) => d.id !== ignoreId && d.name.toLowerCase() === name.toLowerCase())
    return have ? 'This designation is already available to your chapter.' : null
  }
  const same = db.designations.filter((d) => d.id !== ignoreId && !d.chapterId && d.name.toLowerCase() === name.toLowerCase())
  if (same.some((d) => d.regionId === regionId && !d.hidden)) return regionId ? 'This region already has a designation with this name.' : 'A default designation with this name already exists.'
  if (regionId) {
    /* a default the region has changed or removed no longer counts */
    const replaced = new Set(db.designations.filter((d) => d.regionId === regionId && d.sourceId).map((d) => d.sourceId))
    if (same.some((d) => !d.regionId && d.id !== sourceId && !replaced.has(d.id))) return 'This is already a default designation for every region.'
  }
  return null
}

export async function createDesignation(regionId: string, input: DesignationInput, chapterId = ''): Promise<ActionResult> {
  const name = input.name.trim()
  /* An empty region id is a default for every region (super admin only); a chapter id makes it that chapter's own. */
  const clash = designationClash(regionId, name, '', '', chapterId)
  if (clash) return { field: 'name', error: clash }
  const res = await apiRequest<any>('/masters/designations/', {
    method: 'POST',
    body: JSON.stringify({ region: regionId || null, chapter: chapterId || null, ...designationPayload(input) }),
  })
  if (res.error) return { error: res.error }
  const d: Designation = {
    id: res.data?.id || uid('ds'),
    regionId,
    chapterId,
    name,
    description: (input.description || '').trim(),
    isHeadTable: Boolean(input.isHeadTable),
    isLeadershipTeam: Boolean(input.isLeadershipTeam),
    multiChapterLogin: Boolean(input.multiChapterLogin),
    multiChapterAddOnly: Boolean(input.multiChapterAddOnly),
    permissions: Array.isArray(input.permissions) ? input.permissions : [],
    isActive: input.isActive !== undefined ? input.isActive : true,
    createdAt: res.data?.created_at || iso(),
  }
  commit({ ...db, designations: [...db.designations, d] })
  return { id: d.id }
}

/**
 * A region admin changes a default for their own region. This saves the region's own version, which replaces the
 * default in that region only; the default itself and other regions are untouched.
 */
export async function customiseDesignation(defaultId: string, regionId: string, input: DesignationInput, chapterId = ''): Promise<ActionResult> {
  const base = db.designations.find((d) => d.id === defaultId && !d.chapterId)
  if (!base) return { error: 'Designation not found.' }
  const name = input.name.trim()
  /* with a chapter id this is that chapter's own version of a designation it gets from its region or the defaults */
  const clash = chapterId ? designationClash(regionId, name, defaultId, defaultId, chapterId) : designationClash(regionId, name, '', defaultId)
  if (clash) return { field: 'name', error: clash }
  const res = await apiRequest<any>('/masters/designations/', {
    method: 'POST',
    body: JSON.stringify({ region: regionId, chapter: chapterId || null, source: defaultId, ...designationPayload(input) }),
  })
  if (res.error) return { error: res.error }
  const d: Designation = {
    id: res.data?.id || uid('ds'),
    regionId,
    chapterId,
    sourceId: defaultId,
    hidden: false,
    name,
    description: (input.description || '').trim(),
    isHeadTable: Boolean(input.isHeadTable),
    isLeadershipTeam: Boolean(input.isLeadershipTeam),
    multiChapterLogin: Boolean(input.multiChapterLogin),
    multiChapterAddOnly: Boolean(input.multiChapterAddOnly),
    permissions: Array.isArray(input.permissions) ? input.permissions : [],
    isActive: input.isActive !== undefined ? input.isActive : true,
    createdAt: res.data?.created_at || iso(),
  }
  commit({ ...db, designations: [...db.designations, d] })
  return { id: d.id }
}

/**
 * A region admin removes a default (or their own version of one) from their region only.
 * It is hidden there, not deleted, so other regions keep it and the default does not come back.
 */
export async function removeDesignationForRegion(id: string, regionId: string, chapterId = ''): Promise<ActionResult> {
  const current = db.designations.find((d) => d.id === id)
  if (!current) return { error: 'Designation not found.' }
  /* already this region's (or this chapter's) own row: hide it; otherwise save a hidden version of what it inherits */
  if (chapterId ? current.chapterId === chapterId : Boolean(current.regionId)) {
    const res = await apiRequest<any>(`/masters/designations/${id}/`, { method: 'PATCH', body: JSON.stringify({ is_hidden: true }) })
    if (res.error) return { error: res.error }
    commit({ ...db, designations: db.designations.map((d) => (d.id === id ? { ...d, hidden: true } : d)) })
    return { id }
  }
  const res = await apiRequest<any>('/masters/designations/', {
    method: 'POST',
    body: JSON.stringify({ region: regionId, chapter: chapterId || null, source: id, ...designationPayload(current), is_hidden: true }),
  })
  if (res.error) return { error: res.error }
  const hidden: Designation = { ...current, id: res.data?.id || uid('ds'), regionId, chapterId, sourceId: id, hidden: true }
  commit({ ...db, designations: [...db.designations, hidden] })
  return { id }
}

export async function updateDesignation(id: string, input: DesignationInput): Promise<ActionResult> {
  const current = db.designations.find((d) => d.id === id)
  if (!current) return { error: 'Designation not found.' }
  const name = input.name.trim()
  const clash = designationClash(current.regionId, name, id, '', current.chapterId ?? '')
  if (clash) return { field: 'name', error: clash }
  const res = await apiRequest<any>(`/masters/designations/${id}/`, { method: 'PATCH', body: JSON.stringify(designationPayload(input)) })
  if (res.error) return { error: res.error }
  commit({
    ...db,
    designations: db.designations.map((d) =>
      d.id === id
        ? {
            ...d,
            name,
            description: (input.description || '').trim(),
            isHeadTable: Boolean(input.isHeadTable),
            isLeadershipTeam: Boolean(input.isLeadershipTeam),
            multiChapterLogin: Boolean(input.multiChapterLogin),
            multiChapterAddOnly: Boolean(input.multiChapterAddOnly),
            permissions: Array.isArray(input.permissions) ? input.permissions : [],
            isActive: input.isActive !== undefined ? input.isActive : true,
          }
        : d,
    ),
  })
  return { id }
}

export async function deleteDesignation(id: string): Promise<ActionResult> {
  const res = await apiRequest<any>(`/masters/designations/${id}/`, { method: 'DELETE' })
  if (res.error) return { error: res.error }
  commit({ ...db, designations: db.designations.filter((d) => d.id !== id) })
  return { id }
}

/* ---------- account heads (income / expense) ---------- */

export interface AccountHeadInput {
  regionId: string
  chapterId: string
  headType: HeadType
  name: string
  comment?: string
  isActive?: boolean
}

/** Why a head name cannot be used in a chapter (or among the defaults when `chapterId` is empty), or null. */
function headClash(chapterId: string, headType: HeadType, name: string, ignoreId = ''): string | null {
  const same = (db.accountHeads || []).filter((h) => h.id !== ignoreId && h.headType === headType && h.name.toLowerCase() === name.toLowerCase())
  if (same.some((h) => h.chapterId === chapterId)) return chapterId ? `This chapter already has an ${headType} head with this name.` : `A default ${headType} head with this name already exists.`
  if (chapterId && same.some((h) => !h.chapterId)) return `This is already a default ${headType} head for every chapter.`
  return null
}

export async function createAccountHead(input: AccountHeadInput): Promise<ActionResult> {
  const name = input.name.trim()
  if (!name) return { field: 'name', error: 'Enter the head name.' }

  const heads = db.accountHeads || []
  /* An empty chapter id is a default for every chapter (super admin only). */
  const clash = headClash(input.chapterId, input.headType, name)
  if (clash) return { field: 'name', error: clash }

  const res = await apiRequest<any>('/masters/account-heads/', {
    method: 'POST',
    body: JSON.stringify({
      region: input.regionId || null,
      chapter: input.chapterId || null,
      head_type: input.headType,
      name,
      comment: (input.comment || '').trim(),
      is_active: input.isActive !== undefined ? input.isActive : true,
    }),
  })
  if (res.error) return { error: res.error }

  const created: AccountHead = {
    id: res.data?.id || uid('ah'),
    regionId: input.regionId,
    chapterId: input.chapterId,
    headType: input.headType,
    name,
    comment: (input.comment || '').trim(),
    isActive: input.isActive !== undefined ? input.isActive : true,
    createdAt: res.data?.created_at || iso(),
    updatedAt: res.data?.updated_at || iso(),
  }

  commit({ ...db, accountHeads: [...heads, created] })
  return { id: created.id }
}

export async function updateAccountHead(id: string, input: Partial<AccountHeadInput>): Promise<ActionResult> {
  const heads = db.accountHeads || []
  const current = heads.find((h) => h.id === id)
  if (!current) return { error: 'Account head not found.' }

  const nextName = input.name !== undefined ? input.name.trim() : current.name
  const nextType = input.headType !== undefined ? input.headType : current.headType

  if (!nextName) return { field: 'name', error: 'Enter the head name.' }

  const clash = headClash(current.chapterId, nextType, nextName, id)
  if (clash) return { field: 'name', error: clash }

  const payload: any = {}
  if (input.name !== undefined) payload.name = nextName
  if (input.headType !== undefined) payload.head_type = nextType
  if (input.comment !== undefined) payload.comment = input.comment.trim()
  if (input.isActive !== undefined) payload.is_active = input.isActive

  const res = await apiRequest<any>(`/masters/account-heads/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (res.error) return { error: res.error }

  commit({
    ...db,
    accountHeads: heads.map((h) =>
      h.id === id
        ? {
            ...h,
            name: nextName,
            headType: nextType,
            comment: input.comment !== undefined ? input.comment.trim() : h.comment,
            isActive: input.isActive !== undefined ? input.isActive : h.isActive,
            updatedAt: res.data?.updated_at || iso(),
          }
        : h,
    ),
  })
  return { id }
}

export async function deleteAccountHead(id: string): Promise<ActionResult> {
  const res = await apiRequest<any>(`/masters/account-heads/${id}/`, { method: 'DELETE' })
  if (res.error) return { error: res.error }
  commit({ ...db, accountHeads: (db.accountHeads || []).filter((h) => h.id !== id) })
  return { id }
}

/* ---------- mode of pay ---------- */

export interface ModeOfPayInput {
  regionId: string
  chapterId: string
  name: string
  code?: string
  description?: string
  isActive?: boolean
}

export async function createModeOfPay(input: ModeOfPayInput): Promise<ActionResult> {
  const name = input.name.trim()
  if (!name) return { field: 'name', error: 'Name is required.' }

  const modes = db.paymentModes || []
  if (modes.some((m) => m.chapterId === input.chapterId && m.name.toLowerCase() === name.toLowerCase())) {
    return { field: 'name', error: 'A mode of payment with this name already exists in this chapter.' }
  }

  const res = await apiRequest<any>('/masters/payment-modes/', {
    method: 'POST',
    body: JSON.stringify({
      region: input.regionId,
      chapter: input.chapterId,
      name,
      code: input.code?.trim() || '',
      description: input.description?.trim() || '',
      is_active: input.isActive !== undefined ? input.isActive : true,
    }),
  })
  if (res.error) return { error: res.error }

  const created: ModeOfPay = {
    id: res.data?.id || `mop-${Date.now()}`,
    regionId: input.regionId,
    chapterId: input.chapterId,
    name,
    code: input.code?.trim() || '',
    description: input.description?.trim() || '',
    isActive: input.isActive !== undefined ? input.isActive : true,
    createdAt: res.data?.created_at || iso(),
    updatedAt: res.data?.updated_at || iso(),
  }
  commit({ ...db, paymentModes: [...modes, created] })
  return { id: created.id }
}

export async function updateModeOfPay(id: string, input: Partial<ModeOfPayInput>): Promise<ActionResult> {
  const modes = db.paymentModes || []
  const current = modes.find((m) => m.id === id)
  if (!current) return { error: 'Mode of pay not found.' }

  const nextName = input.name !== undefined ? input.name.trim() : current.name
  if (!nextName) return { field: 'name', error: 'Name cannot be empty.' }

  if (input.name !== undefined && nextName.toLowerCase() !== current.name.toLowerCase()) {
    if (modes.some((m) => m.id !== id && m.chapterId === current.chapterId && m.name.toLowerCase() === nextName.toLowerCase())) {
      return { field: 'name', error: 'A mode of payment with this name already exists.' }
    }
  }

  const payload: any = {}
  if (input.name !== undefined) payload.name = nextName
  if (input.code !== undefined) payload.code = input.code.trim()
  if (input.description !== undefined) payload.description = input.description.trim()
  if (input.isActive !== undefined) payload.is_active = input.isActive

  const res = await apiRequest<any>(`/masters/payment-modes/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (res.error) return { error: res.error }

  commit({
    ...db,
    paymentModes: modes.map((m) =>
      m.id === id
        ? {
            ...m,
            name: nextName,
            code: input.code !== undefined ? input.code.trim() : m.code,
            description: input.description !== undefined ? input.description.trim() : m.description,
            isActive: input.isActive !== undefined ? input.isActive : m.isActive,
            updatedAt: res.data?.updated_at || iso(),
          }
        : m,
    ),
  })
  return { id }
}

export async function deleteModeOfPay(id: string): Promise<ActionResult> {
  const res = await apiRequest<any>(`/masters/payment-modes/${id}/`, { method: 'DELETE' })
  if (res.error) return { error: res.error }
  commit({ ...db, paymentModes: (db.paymentModes || []).filter((m) => m.id !== id) })
  return { id }
}

/* ---------- financial year settings ---------- */

export interface FinancialYearInput {
  regionId: string
  chapterId: string
  title: string
  startDate: string
  endDate: string
  billStartNumber?: number
  invoicePrefix?: string
  invoiceStartNumber?: number
  receiptPrefix?: string
  receiptStartNumber?: number
  voucherPrefix?: string
  voucherStartNumber?: number
  isCurrent?: boolean
  isLocked?: boolean
}

export async function createFinancialYear(input: FinancialYearInput): Promise<ActionResult> {
  const title = input.title.trim()
  if (!title) return { field: 'title', error: 'Select a financial year.' }
  if (!input.startDate) return { field: 'startDate', error: 'Start date is required.' }
  if (!input.endDate) return { field: 'endDate', error: 'End date is required.' }
  if (input.startDate > input.endDate) return { field: 'endDate', error: 'End date must be after start date.' }

  const years = db.financialYears || []
  if (years.some((y) => y.chapterId === input.chapterId && y.title.toLowerCase() === title.toLowerCase())) {
    return { field: 'title', error: 'This financial year already exists in this chapter.' }
  }

  const billStart = input.billStartNumber !== undefined ? Math.max(1, Number(input.billStartNumber) || 1) : 1
  const invPrefix = (input.invoicePrefix || 'INV').trim().toUpperCase()
  const invStart = input.invoiceStartNumber !== undefined ? Math.max(1, Number(input.invoiceStartNumber) || 1) : 1
  const recPrefix = (input.receiptPrefix || 'REC').trim().toUpperCase()
  const recStart = input.receiptStartNumber !== undefined ? Math.max(1, Number(input.receiptStartNumber) || 1) : 1
  const vouPrefix = (input.voucherPrefix || 'VOU').trim().toUpperCase()
  const vouStart = input.voucherStartNumber !== undefined ? Math.max(1, Number(input.voucherStartNumber) || 1) : 1

  const res = await apiRequest<any>('/masters/financial-years/', {
    method: 'POST',
    body: JSON.stringify({
      region: input.regionId,
      chapter: input.chapterId,
      title,
      start_date: input.startDate,
      end_date: input.endDate,
      bill_start_number: billStart,
      invoice_prefix: invPrefix,
      invoice_start_number: invStart,
      receipt_prefix: recPrefix,
      receipt_start_number: recStart,
      voucher_prefix: vouPrefix,
      voucher_start_number: vouStart,
      is_current: Boolean(input.isCurrent),
      is_locked: Boolean(input.isLocked),
    }),
  })
  if (res.error) return { error: res.error }

  const created: FinancialYear = {
    id: res.data?.id || `fy-${Date.now()}`,
    regionId: input.regionId,
    chapterId: input.chapterId,
    title,
    startDate: input.startDate,
    endDate: input.endDate,
    billStartNumber: billStart,
    invoicePrefix: invPrefix,
    invoiceStartNumber: invStart,
    receiptPrefix: recPrefix,
    receiptStartNumber: recStart,
    voucherPrefix: vouPrefix,
    voucherStartNumber: vouStart,
    isCurrent: Boolean(input.isCurrent),
    isLocked: Boolean(input.isLocked),
    createdAt: res.data?.created_at || iso(),
    updatedAt: res.data?.updated_at || iso(),
  }

  const nextYears = input.isCurrent
    ? years.map((y) => (y.chapterId === input.chapterId ? { ...y, isCurrent: false } : y))
    : years

  commit({ ...db, financialYears: [...nextYears, created] })
  return { id: created.id }
}

export async function updateFinancialYear(id: string, input: Partial<FinancialYearInput>): Promise<ActionResult> {
  const years = db.financialYears || []
  const current = years.find((y) => y.id === id)
  if (!current) return { error: 'Financial year not found.' }

  const nextTitle = input.title !== undefined ? input.title.trim() : current.title
  const nextStart = input.startDate !== undefined ? input.startDate : current.startDate
  const nextEnd = input.endDate !== undefined ? input.endDate : current.endDate
  const nextBillStart = input.billStartNumber !== undefined ? Math.max(1, Number(input.billStartNumber) || 1) : current.billStartNumber
  const nextInvPrefix = input.invoicePrefix !== undefined ? input.invoicePrefix.trim().toUpperCase() : (current.invoicePrefix || 'INV')
  const nextInvStart = input.invoiceStartNumber !== undefined ? Math.max(1, Number(input.invoiceStartNumber) || 1) : (current.invoiceStartNumber || 1)
  const nextRecPrefix = input.receiptPrefix !== undefined ? input.receiptPrefix.trim().toUpperCase() : (current.receiptPrefix || 'REC')
  const nextRecStart = input.receiptStartNumber !== undefined ? Math.max(1, Number(input.receiptStartNumber) || 1) : (current.receiptStartNumber || 1)
  const nextVouPrefix = input.voucherPrefix !== undefined ? input.voucherPrefix.trim().toUpperCase() : (current.voucherPrefix || 'VOU')
  const nextVouStart = input.voucherStartNumber !== undefined ? Math.max(1, Number(input.voucherStartNumber) || 1) : (current.voucherStartNumber || 1)

  if (!nextTitle) return { field: 'title', error: 'Financial year cannot be empty.' }
  if (nextStart > nextEnd) return { field: 'endDate', error: 'End date must be after start date.' }

  const payload: any = {}
  if (input.title !== undefined) payload.title = nextTitle
  if (input.startDate !== undefined) payload.start_date = nextStart
  if (input.endDate !== undefined) payload.end_date = nextEnd
  if (input.billStartNumber !== undefined) payload.bill_start_number = nextBillStart
  if (input.invoicePrefix !== undefined) payload.invoice_prefix = nextInvPrefix
  if (input.invoiceStartNumber !== undefined) payload.invoice_start_number = nextInvStart
  if (input.receiptPrefix !== undefined) payload.receipt_prefix = nextRecPrefix
  if (input.receiptStartNumber !== undefined) payload.receipt_start_number = nextRecStart
  if (input.voucherPrefix !== undefined) payload.voucher_prefix = nextVouPrefix
  if (input.voucherStartNumber !== undefined) payload.voucher_start_number = nextVouStart
  if (input.isCurrent !== undefined) payload.is_current = input.isCurrent
  if (input.isLocked !== undefined) payload.is_locked = input.isLocked

  const res = await apiRequest<any>(`/masters/financial-years/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (res.error) return { error: res.error }

  commit({
    ...db,
    financialYears: years.map((y) => {
      if (input.isCurrent && y.chapterId === current.chapterId && y.id !== id) {
        return { ...y, isCurrent: false }
      }
      if (y.id === id) {
        return {
          ...y,
          title: nextTitle,
          startDate: nextStart,
          endDate: nextEnd,
          billStartNumber: nextBillStart,
          invoicePrefix: nextInvPrefix,
          invoiceStartNumber: nextInvStart,
          receiptPrefix: nextRecPrefix,
          receiptStartNumber: nextRecStart,
          voucherPrefix: nextVouPrefix,
          voucherStartNumber: nextVouStart,
          isCurrent: input.isCurrent !== undefined ? input.isCurrent : y.isCurrent,
          isLocked: input.isLocked !== undefined ? input.isLocked : y.isLocked,
          updatedAt: res.data?.updated_at || iso(),
        }
      }
      return y
    }),
  })
  return { id }
}

export async function deleteFinancialYear(id: string): Promise<ActionResult> {
  const res = await apiRequest<any>(`/masters/financial-years/${id}/`, { method: 'DELETE' })
  if (res.error) return { error: res.error }
  commit({ ...db, financialYears: (db.financialYears || []).filter((y) => y.id !== id) })
  return { id }
}

/* ---------- bank master ---------- */

export interface BankMasterInput {
  regionId: string
  chapterId: string
  bankName: string
  accountName?: string
  accountNumber?: string
  ifscCode?: string
  branch?: string
  upiId?: string
  openingBalance?: number
  isDefault?: boolean
  isActive?: boolean
}

export async function createBankMaster(input: BankMasterInput): Promise<ActionResult> {
  const bankName = input.bankName.trim()
  const accountName = (input.accountName || '').trim()
  const accountNumber = (input.accountNumber || '').trim()

  if (!bankName) return { field: 'bankName', error: 'Bank name is required.' }

  const banks = db.bankAccounts || []
  if (accountNumber && banks.some((b) => b.chapterId === input.chapterId && b.accountNumber === accountNumber)) {
    return { field: 'accountNumber', error: 'A bank account with this account number already exists.' }
  }

  const res = await apiRequest<any>('/masters/bank-accounts/', {
    method: 'POST',
    body: JSON.stringify({
      region: input.regionId,
      chapter: input.chapterId,
      bank_name: bankName,
      account_name: accountName,
      account_number: accountNumber,
      ifsc_code: input.ifscCode?.trim() || '',
      branch: input.branch?.trim() || '',
      upi_id: input.upiId?.trim() || '',
      opening_balance: input.openingBalance !== undefined ? input.openingBalance : 0,
      is_default: Boolean(input.isDefault),
      is_active: input.isActive !== undefined ? input.isActive : true,
    }),
  })
  if (res.error) return { error: res.error }

  const created: BankMaster = {
    id: res.data?.id || `bank-${Date.now()}`,
    regionId: input.regionId,
    chapterId: input.chapterId,
    bankName,
    accountName,
    accountNumber,
    ifscCode: input.ifscCode?.trim() || '',
    branch: input.branch?.trim() || '',
    upiId: input.upiId?.trim() || '',
    openingBalance: input.openingBalance !== undefined ? Number(input.openingBalance) : 0,
    isDefault: Boolean(input.isDefault),
    isActive: input.isActive !== undefined ? input.isActive : true,
    createdAt: res.data?.created_at || iso(),
    updatedAt: res.data?.updated_at || iso(),
  }

  const nextBanks = input.isDefault
    ? banks.map((b) => (b.chapterId === input.chapterId ? { ...b, isDefault: false } : b))
    : banks

  commit({ ...db, bankAccounts: [...nextBanks, created] })
  return { id: created.id }
}

export async function updateBankMaster(id: string, input: Partial<BankMasterInput>): Promise<ActionResult> {
  const banks = db.bankAccounts || []
  const current = banks.find((b) => b.id === id)
  if (!current) return { error: 'Bank account not found.' }

  const nextBankName = input.bankName !== undefined ? input.bankName.trim() : current.bankName
  const nextAccountName = input.accountName !== undefined ? input.accountName.trim() : current.accountName
  const nextAccountNumber = input.accountNumber !== undefined ? input.accountNumber.trim() : current.accountNumber

  if (!nextBankName) return { field: 'bankName', error: 'Bank name cannot be empty.' }

  const payload: any = {}
  if (input.bankName !== undefined) payload.bank_name = nextBankName
  if (input.accountName !== undefined) payload.account_name = nextAccountName
  if (input.accountNumber !== undefined) payload.account_number = nextAccountNumber
  if (input.ifscCode !== undefined) payload.ifsc_code = input.ifscCode.trim()
  if (input.branch !== undefined) payload.branch = input.branch.trim()
  if (input.upiId !== undefined) payload.upi_id = input.upiId.trim()
  if (input.openingBalance !== undefined) payload.opening_balance = input.openingBalance
  if (input.isDefault !== undefined) payload.is_default = input.isDefault
  if (input.isActive !== undefined) payload.is_active = input.isActive

  const res = await apiRequest<any>(`/masters/bank-accounts/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (res.error) return { error: res.error }

  commit({
    ...db,
    bankAccounts: banks.map((b) => {
      if (input.isDefault && b.chapterId === current.chapterId && b.id !== id) {
        return { ...b, isDefault: false }
      }
      if (b.id === id) {
        return {
          ...b,
          bankName: nextBankName,
          accountName: nextAccountName,
          accountNumber: nextAccountNumber,
          ifscCode: input.ifscCode !== undefined ? input.ifscCode.trim() : b.ifscCode,
          branch: input.branch !== undefined ? input.branch.trim() : b.branch,
          upiId: input.upiId !== undefined ? input.upiId.trim() : b.upiId,
          openingBalance: input.openingBalance !== undefined ? Number(input.openingBalance) : b.openingBalance,
          isDefault: input.isDefault !== undefined ? input.isDefault : b.isDefault,
          isActive: input.isActive !== undefined ? input.isActive : b.isActive,
          updatedAt: res.data?.updated_at || iso(),
        }
      }
      return b
    }),
  })
  return { id }
}

export async function deleteBankMaster(id: string): Promise<ActionResult> {
  const res = await apiRequest<any>(`/masters/bank-accounts/${id}/`, { method: 'DELETE' })
  if (res.error) return { error: res.error }
  commit({ ...db, bankAccounts: (db.bankAccounts || []).filter((b) => b.id !== id) })
  return { id }
}

export async function setChapterUpi(chapterId: string, upiId: string, upiName: string): Promise<ActionResult> {
  const id = upiId.trim()
  if (!/^[\w.-]{2,}@[a-zA-Z][a-zA-Z0-9]{1,}$/.test(id)) return { field: 'upiId', error: 'Enter a valid UPI ID, for example name@bank.' }
  if (!upiName.trim()) return { field: 'upiName', error: 'Enter the name shown to the payer.' }

  const res = await apiRequest<any>(`/chapters/${chapterId}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      upi_id: id,
      upi_name: upiName.trim(),
    }),
  })

  if (res.error) return { error: res.error }

  commit({ ...db, chapters: db.chapters.map((c) => (c.id === chapterId ? { ...c, upiId: id, upiName: upiName.trim() } : c)) })
  return { id: chapterId }
}

/** The chapter's Due List (every member may read it while the head table has it on). Null when it cannot be read. */
export async function fetchDueList(): Promise<DueListData | null> {
  const res = await apiRequest<any>('/members/due-list/')
  if (res.error || !res.data) return null
  const d = res.data
  return {
    enabled: Boolean(d.enabled),
    mode: d.mode === 'due_date' ? 'due_date' : 'default',
    day: Number(d.day) || 21,
    members: (d.members || []).map((r: any) => ({
      member: String(r.member),
      memberName: r.member_name,
      total: Number(r.total),
      dues: (r.dues || []).map((x: any) => ({ id: x.id, label: x.label, amount: Number(x.amount), dueDate: x.due_date || '', overdue: Boolean(x.overdue) })),
    })),
  }
}

/** The App Usage Report: who has signed up, completed a profile and used attendance, polls and paying dues. Head table only. Null when it cannot be read. */
export async function fetchAppUsage(chapterId?: string): Promise<AppUsageData | null> {
  /* the Super Admin names the chapter to look at; a head table member always gets their own */
  const res = await apiRequest<any>(chapterId ? `/members/app-usage/?chapter=${encodeURIComponent(chapterId)}` : '/members/app-usage/')
  if (res.error || !res.data) return null
  const d = res.data
  return {
    members: (d.members || []).map((r: any) => ({
      member: String(r.member),
      name: r.name,
      designation: r.designation,
      signedUp: Boolean(r.signed_up),
      profileComplete: Boolean(r.profile_complete),
      attended: Boolean(r.attended),
      voted: Boolean(r.voted),
      paid: Boolean(r.paid),
    })),
  }
}

/** The Super Admin's App Usage summary: every chapter with how many members have signed up, completed a profile and used each activity. Null when it cannot be read. */
export async function fetchAppUsageSummary(): Promise<AppUsageChapter[] | null> {
  const res = await apiRequest<any>('/members/app-usage/summary/')
  if (res.error || !res.data) return null
  return (res.data.chapters || []).map((c: any) => ({
    chapter: String(c.chapter),
    name: c.name,
    code: c.code || '',
    isActive: c.is_active !== false,
    region: String(c.region),
    regionName: c.region_name,
    regionCode: c.region_code || '',
    members: Number(c.members) || 0,
    signedUp: Number(c.signed_up) || 0,
    profileComplete: Number(c.profile_complete) || 0,
    attended: Number(c.attended) || 0,
    voted: Number(c.voted) || 0,
    paid: Number(c.paid) || 0,
  }))
}

/** Settings > Due List: turns it on or off and sets the way of listing. Saved on the server, so every member's device follows it. */
export async function setDueList(chapterId: string, enabled: boolean, mode: DueListMode): Promise<ActionResult> {
  const res = await apiRequest<any>(`/chapters/${chapterId}/settings/`, {
    method: 'PATCH',
    body: JSON.stringify({ due_list_enabled: enabled, due_list_mode: mode }),
  })
  if (res.error) return { error: res.error }
  commit({ ...db, chapters: db.chapters.map((c) => (c.id === chapterId ? { ...c, dueListEnabled: enabled, dueListMode: mode } : c)) })
  return { id: chapterId }
}

export async function deleteChapter(id: string): Promise<ActionResult> {
  const target = db.chapters.find((c) => c.id === id)
  const membersCount = db.members.filter((m) => m.chapterId === id).length
  if (membersCount > 0) {
    return { error: `Cannot delete chapter '${target?.name || ''}' because it has ${membersCount} member(s) connected.` }
  }

  const res = await apiRequest(`/chapters/${id}/`, { method: 'DELETE' })
  if (res.error) return { error: res.error }

  commit({
    ...db,
    chapters: db.chapters.filter((c) => c.id !== id),
    meetings: db.meetings.filter((m) => m.chapterId !== id),
  })
  return { id }
}

/* ---------- profile ---------- */

/** Saves just the photo, so a new picture shows in the top bar and directory straight away. */
export async function setMemberPhoto(id: string, photo: string) {
  await apiRequest<any>('/members/me/', {
    method: 'PATCH',
    body: JSON.stringify({ photo }),
  })
  commit({ ...db, members: db.members.map((m) => (m.id === id ? { ...m, photo } : m)) })
}

export async function saveProfile(
  id: string,
  input: { designation: string; organisation: string; category: string; photo: string; profile: Profile },
): Promise<ActionResult> {
  const res = await apiRequest<any>('/members/me/', {
    method: 'PATCH',
    body: JSON.stringify({
      designation: input.designation,
      organisation: input.organisation.trim(),
      category: input.category.trim(),
      photo: input.photo,
      email: input.profile.email,
      website: input.profile.website,
      social: input.profile.social,
      dob: input.profile.dob || null,
      married: input.profile.married || '',
      anniversary: input.profile.anniversary || null,
      date_of_joining: input.profile.dateOfJoining || null,
      spouse: input.profile.spouse,
      profile_state: 'saved',
    }),
  })

  if (res.error) {
    /* a refused field comes back as { field: [message] }: say which one */
    const first = res.data && typeof res.data === 'object' ? Object.entries(res.data as Record<string, unknown>)[0] : undefined
    if (first && Array.isArray(first[1]) && typeof first[1][0] === 'string') return { field: first[0], error: first[1][0] }
    return { error: res.error }
  }

  commit({
    ...db,
    members: db.members.map((m) =>
      m.id === id
        ? {
            ...m,
            designation: input.designation,
            organisation: input.organisation.trim(),
            category: input.category.trim(),
            photo: input.photo,
            profile: input.profile,
            profileState: 'saved',
          }
        : m,
    ),
  })
  return { id }
}

export async function skipProfile(id: string) {
  await apiRequest<any>('/members/me/', {
    method: 'PATCH',
    body: JSON.stringify({ profile_state: 'skipped' }),
  })
  commit({ ...db, members: db.members.map((m) => (m.id === id && m.profileState === 'pending' ? { ...m, profileState: 'skipped' } : m)) })
}

/* ---------- meetings + attendance ---------- */

export async function createMeeting(input: Omit<Meeting, 'id' | 'createdAt' | 'invitedIds'>): Promise<ActionResult> {
  const res = await apiRequest<any>('/chapters/meetings/', {
    method: 'POST',
    body: JSON.stringify({
      region: input.regionId,
      chapter: input.chapterId,
      title: input.title.trim(),
      mode: input.mode,
      starts_at: input.startsAt,
      duration_min: input.durationMin,
      venue: input.venue.trim(),
      lat: input.lat,
      lng: input.lng,
      radius_m: input.radiusM,
      audience: input.audience,
      audience_designations: input.audience === 'designations' ? input.audienceDesignations : [],
      invitees: input.audience === 'members' ? input.inviteeIds : [],
    }),
  })

  if (res.error) {
    /* the server's message for the "Meeting for" choice, if that is what it refused */
    const refused = res.data?.audience_designations?.[0] ?? res.data?.invitees?.[0]
    return refused ? { field: 'audience', error: refused } : { error: res.error }
  }

  const meeting: Meeting = {
    ...input,
    invitedIds: (res.data?.invited_ids || []).map(String),
    title: input.title.trim(),
    venue: input.venue.trim(),
    id: res.data?.id || uid('mt'),
    createdAt: res.data?.created_at || iso(),
  }
  commit({ ...db, meetings: [...db.meetings, meeting] })
  return { id: meeting.id }
}

export async function deleteMeeting(id: string) {
  await apiRequest(`/chapters/meetings/${id}/`, { method: 'DELETE' })
  commit({ ...db, meetings: db.meetings.filter((m) => m.id !== id), attendance: db.attendance.filter((a) => a.meetingId !== id) })
}

export type AttendanceProof = { method: 'online' } | { method: 'qr'; code: string } | { method: 'geofence'; lat: number; lng: number }

/** Checks the meeting window and the proof, then records the member as present. */
export async function markAttendance(memberId: string, meetingId: string, proof: AttendanceProof): Promise<ActionResult> {
  const member = db.members.find((m) => m.id === memberId)
  const meeting = db.meetings.find((m) => m.id === meetingId)
  if (!member || !meeting || member.chapterId !== meeting.chapterId || (meeting.invitedIds?.length && !meeting.invitedIds.includes(memberId))) return { error: 'This meeting is not available for you.' }
  if (db.attendance.some((a) => a.meetingId === meetingId && a.memberId === memberId)) return { error: 'Your attendance is already marked.' }

  const now = Date.now()
  const phase = phaseOf(meeting, now)
  if (phase === 'upcoming') return { error: `Attendance opens at ${fmtTime(new Date(windowOf(meeting).opensAt).toISOString())}.` }
  if (phase === 'ended') return { error: 'This meeting has ended.' }

  let method: AttendanceMethod
  let lat: number | undefined
  let lng: number | undefined
  let distance: number | undefined

  if (meeting.mode === 'online') {
    if (proof.method !== 'online') return { error: 'This is an online meeting.' }
    method = 'online'
  } else if (proof.method === 'qr') {
    if (!codeValid(meeting.id, proof.code, now)) return { field: 'code', error: 'That code is not valid or has expired. Scan the latest QR code.' }
    method = 'qr'
  } else if (proof.method === 'geofence') {
    if (meeting.lat == null || meeting.lng == null) return { error: 'The meeting location is not set.' }
    distance = Math.round(distanceM(proof.lat, proof.lng, meeting.lat, meeting.lng))
    if (distance > meeting.radiusM) return { error: `You are ${distance} m from the venue. Move within ${meeting.radiusM} m to mark attendance.` }
    method = 'geofence'
    lat = proof.lat
    lng = proof.lng
  } else {
    return { error: 'This meeting is offline. Scan the QR code or use your location.' }
  }

  const res = await apiRequest<any>('/members/attendance/', {
    method: 'POST',
    body: JSON.stringify({
      meeting: meetingId,
      method,
      lat,
      lng,
    }),
  })

  if (res.error) return { error: res.error }

  commit({ ...db, attendance: [...db.attendance, { id: res.data?.id || uid('at'), meetingId, memberId, method, at: iso(), distanceM: distance }] })
  return {}
}

/** The head table marks a member present by hand, at the time they arrived (an ISO date-time inside the meeting). */
export async function markManualAttendance(memberId: string, meetingId: string, at: string): Promise<ActionResult> {
  const res = await apiRequest<any>('/members/attendance/manual/', {
    method: 'POST',
    body: JSON.stringify({ meeting: meetingId, member: memberId, marked_at: at }),
  })
  if (res.error) return { error: res.error }
  commit({ ...db, attendance: [...db.attendance, { id: res.data?.id || uid('at'), meetingId, memberId, method: 'manual', at: res.data?.marked_at ?? at }] })
  return {}
}

/* ---------- substitutes & visitors ---------- */

export async function addSubstitute(input: {
  chapterId: string
  meetingId: string
  memberId: string
  substituteName: string
  substituteCompany?: string
  substitutePhone?: string
  substituteEmail?: string
  notes?: string
}): Promise<ActionResult> {
  const name = input.substituteName.trim()
  if (!name) return { field: 'substituteName', error: 'Enter the substitute name.' }
  if (!input.memberId) return { field: 'memberId', error: 'Select the member represented.' }

  const sub: Substitute = {
    id: uid('sub'),
    chapterId: input.chapterId,
    meetingId: input.meetingId,
    memberId: input.memberId,
    substituteName: name,
    substituteCompany: input.substituteCompany?.trim(),
    substitutePhone: input.substitutePhone?.trim(),
    substituteEmail: input.substituteEmail?.trim(),
    notes: input.notes?.trim(),
    createdAt: iso(),
  }

  const existing = (db.substitutes || []).filter((s) => !(s.meetingId === input.meetingId && s.memberId === input.memberId))
  commit({ ...db, substitutes: [sub, ...existing] })
  return { id: sub.id }
}

export async function deleteSubstitute(id: string): Promise<ActionResult> {
  commit({ ...db, substitutes: (db.substitutes || []).filter((s) => s.id !== id) })
  return {}
}

export async function addVisitor(input: {
  chapterId: string
  meetingId: string
  invitedById?: string
  name: string
  company: string
  category?: string
  phone: string
  email?: string
  notes?: string
}): Promise<ActionResult> {
  const name = input.name.trim()
  if (!name) return { field: 'name', error: 'Enter the visitor name.' }
  const company = input.company.trim()
  if (!company) return { field: 'company', error: 'Enter the visitor business or company.' }

  const vis: Visitor = {
    id: uid('vis'),
    chapterId: input.chapterId,
    meetingId: input.meetingId,
    invitedById: input.invitedById,
    name,
    company,
    category: input.category?.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim(),
    notes: input.notes?.trim(),
    createdAt: iso(),
  }

  commit({ ...db, visitors: [vis, ...(db.visitors || [])] })
  return { id: vis.id }
}

export async function deleteVisitor(id: string): Promise<ActionResult> {
  commit({ ...db, visitors: (db.visitors || []).filter((v) => v.id !== id) })
  return {}
}

/* ---------- dues ---------- */

export interface PaymentDetails {
  /** The mode of pay as named in the chapter's Mode of Pay list. */
  modeName?: string
  txnId?: string
  txnDate?: string
  chequeNo?: string
  chequeDate?: string
}

function checkDetails(method: PayMethod, d: PaymentDetails): ActionResult | null {
  if (method === 'UPI') {
    if (!d.txnId?.trim()) return { field: 'txnId', error: 'Enter the UPI transaction ID.' }
    if (!d.txnDate) return { field: 'txnDate', error: 'Choose the transaction date.' }
  }
  if (method === 'Cheque') {
    if (!d.chequeNo?.trim()) return { field: 'chequeNo', error: 'Enter the cheque number.' }
    if (!d.chequeDate) return { field: 'chequeDate', error: 'Choose the cheque date.' }
  }
  return null
}

function toVoucher(v: any): Voucher {
  return {
    id: v.id,
    regionId: v.region,
    chapterId: v.chapter,
    financialYearId: v.financial_year,
    financialYearTitle: v.financial_year_title || '',
    kind: v.kind,
    number: v.number,
    date: v.date,
    headId: v.head ?? '',
    headName: v.head_name || '',
    amount: Number(v.amount),
    modeName: v.mode_name || '',
    remarks: v.remarks || '',
    createdAt: v.created_at,
  }
}

/** An invoice as the server sends it. `member` is the member's profile id, which the app uses everywhere. */
function toInvoice(inv: any): Invoice {
  return {
    id: inv.id,
    no: inv.no || undefined,
    issuedAt: inv.created_at,
    memberId: inv.member ?? String(inv.user),
    label: inv.label,
    amount: Number(inv.amount),
    dueDate: inv.due_date || '',
    status: inv.status,
    paidAt: inv.paid_at || undefined,
    verifiedAt: inv.verified_at || undefined,
    method: inv.method || undefined,
    modeName: inv.mode_name || undefined,
    ref: inv.ref || undefined,
    kind: inv.kind || undefined,
    requestId: inv.request || undefined,
    payAll: inv.pay_all || undefined,
    description: inv.description || undefined,
    txnId: inv.txn_id || undefined,
    txnDate: inv.txn_date || undefined,
    chequeNo: inv.cheque_no || undefined,
    chequeDate: inv.cheque_date || undefined,
  }
}

/** A poll as the server sends it, with how many members picked each option. */
function toPoll(p: any): Poll {
  return {
    id: p.id,
    regionId: p.region,
    chapterId: p.chapter,
    question: p.question,
    description: p.description || '',
    image: p.image || '',
    multiple: p.multiple,
    options: (p.options || []).map((o: any) => ({ id: o.id, text: o.text })),
    closed: p.closed,
    createdAt: p.created_at || new Date().toISOString(),
    counts: Object.fromEntries((p.options || []).map((o: any) => [o.id, Number(o.votes_count) || 0])),
    voters: Number(p.total_votes) || 0,
  }
}

/** The votes the server lets this person see: everyone's for the head table, only their own for other members. */
function toVotes(p: any): Vote[] {
  return (p.votes || []).map((v: any) => ({ id: v.id, pollId: p.id, memberId: v.member ?? '', optionIds: v.option_ids || [], at: v.at }))
}

function toMembership(m: any): Membership {
  return { memberId: m.member_id, chapterId: m.chapter_id, chapterName: m.chapter_name, regionName: m.region_name, designation: m.designation }
}

function saveMemberships(list: Membership[], remember: boolean) {
  memberships = list
  try {
    window.sessionStorage.removeItem(MEMBERSHIPS_KEY)
    window.localStorage.removeItem(MEMBERSHIPS_KEY)
    window[remember ? 'localStorage' : 'sessionStorage'].setItem(MEMBERSHIPS_KEY, JSON.stringify(list))
  } catch {
    /* storage blocked: the list still lives for this tab */
  }
  emit()
}

function toRequest(r: any): PaymentRequest {
  return {
    id: r.id,
    regionId: r.region,
    chapterId: r.chapter,
    typeId: r.head ?? '',
    typeName: r.type_name,
    amount: Number(r.amount),
    description: r.description || '',
    dueDate: r.due_date || '',
    memberIds: r.member_ids || [],
    recurrence: r.recurrence ? { every: r.recurrence.every, from: r.recurrence.from, to: r.recurrence.to, dates: r.recurrence.dates, generatedThrough: r.recurrence.generated_through || undefined } : undefined,
    createdAt: r.created_at,
  }
}

/** The server's names for form fields, as the pages call them. */
const FIELD_NAMES: Record<string, string> = {
  txn_id: 'txnId',
  txn_date: 'txnDate',
  cheque_no: 'chequeNo',
  cheque_date: 'chequeDate',
  member_ids: 'members',
  head: 'typeId',
  member: 'memberId',
  mode_name: 'modeName',
  invoice_ids: 'invoiceId',
  amount: 'amount',
  recurrence: 'recurrence',
}

/** An API failure as an ActionResult, with the form field it belongs to when the server named one. */
function failure(res: { error?: string; data?: any }): ActionResult {
  const key = res.data && typeof res.data === 'object' && !res.data.detail ? Object.keys(res.data)[0] : undefined
  return { error: res.error || 'Something went wrong. Try again.', field: key ? FIELD_NAMES[key] : undefined }
}

/** The payment fields the server expects. */
function paymentBody(method: PayMethod, d: PaymentDetails) {
  return {
    mode_name: d.modeName || method,
    txn_id: method === 'UPI' ? d.txnId?.trim() : '',
    txn_date: method === 'UPI' ? d.txnDate || null : null,
    cheque_no: method === 'Cheque' ? d.chequeNo?.trim() : '',
    cheque_date: method === 'Cheque' ? d.chequeDate || null : null,
  }
}

/** Puts the invoices the server just changed into the store. */
function applyInvoices(rows: any[]) {
  const changed = new Map(rows.map((r) => [r.id as string, toInvoice(r)]))
  const known = new Set(db.invoices.map((i) => i.id))
  /* an advance payment also makes the invoices of dates that had not come yet */
  commit({ ...db, invoices: [...db.invoices.map((i) => changed.get(i.id) ?? i), ...[...changed.values()].filter((i) => !known.has(i.id))] })
}

/** A member pays their own invoices. The dues then wait as `pending` until the chapter verifies them in Payment Verifications. */
export async function payInvoices(memberId: string, invoiceIds: string[], method: PayMethod, details: PaymentDetails = {}): Promise<ActionResult> {
  const picked = db.invoices.filter((i) => invoiceIds.includes(i.id) && i.memberId === memberId && i.status === 'due')
  if (picked.length === 0) return { error: 'There is nothing to pay.' }
  const bad = checkDetails(method, details)
  if (bad) return bad
  const res = await apiRequest<any>('/members/invoices/submit-payment/', {
    method: 'POST',
    body: JSON.stringify({ invoice_ids: picked.map((i) => i.id), ...paymentBody(method, details) }),
  })
  if (res.error) return failure(res)
  applyInvoices(res.data.invoices)
  return { id: res.data.receipt }
}

/** The chapter confirms it received these payments: they move from Verification Pending to paid. */
export async function verifyPayments(invoiceIds: string[]): Promise<ActionResult> {
  const picked = db.invoices.filter((i) => invoiceIds.includes(i.id) && i.status === 'pending')
  if (picked.length === 0) return { error: 'Select the payments to verify.' }
  const res = await apiRequest<any>('/members/invoices/verify/', {
    method: 'POST',
    body: JSON.stringify({ invoice_ids: picked.map((i) => i.id) }),
  })
  if (res.error) return failure(res)
  applyInvoices(res.data.invoices)
  return {}
}

/** An office bearer records a payment received from a member (cheque, cash or UPI). It is paid and verified at once. */
export async function recordPayment(invoiceId: string, method: PayMethod, details: PaymentDetails): Promise<ActionResult> {
  const picked = db.invoices.filter((i) => i.id === invoiceId && i.status === 'due')
  if (picked.length === 0) return { error: 'There is nothing to pay.' }
  const bad = checkDetails(method, details)
  if (bad) return bad
  const res = await apiRequest<any>('/members/invoices/record/', {
    method: 'POST',
    body: JSON.stringify({ invoice_ids: [invoiceId], ...paymentBody(method, details) }),
  })
  if (res.error) return failure(res)
  applyInvoices(res.data.invoices)
  return { id: res.data.receipt }
}

/**
 * An office bearer records one payment that settles every remaining due of a recurring request for a member.
 * The amount must equal what is still owed on that request. All the dues share one receipt number.
 */
export async function recordPaymentForRequest(memberId: string, requestId: string, amount: number, method: PayMethod, details: PaymentDetails): Promise<ActionResult> {
  /* the dues already made plus the dates still to come: those invoices are made now, already paid (an advance payment) */
  const left = remainingOnRequest(db, memberId, requestId, dayOf(Date.now()))
  if (left.count === 0) return { error: 'There is nothing to pay.' }
  const cents = (n: number) => Math.round(n * 100)
  if (cents(amount) !== cents(left.total)) return { field: 'amount', error: `The amount must be ₹${left.total}, the total of the ${left.count} remaining dues.` }
  const bad = checkDetails(method, details)
  if (bad) return bad
  const res = await apiRequest<any>('/members/invoices/record/', {
    method: 'POST',
    body: JSON.stringify({ pay_all: true, request_id: requestId, member: memberId, amount: left.total.toFixed(2), ...paymentBody(method, details) }),
  })
  if (res.error) return failure(res)
  applyInvoices(res.data.invoices)
  return { id: res.data.receipt }
}

/**
 * An office bearer records a payment received from a member that no request asked for: an income head, an amount and the
 * mode of pay. It is saved already paid and verified, with its own invoice and receipt numbers. `id` in the result is the receipt.
 */
export async function recordManualPayment(input: { memberId: string; headId: string; amount: number; description: string; method: PayMethod; details: PaymentDetails }): Promise<ActionResult> {
  if (!db.accountHeads.some((h) => h.id === input.headId)) return { field: 'headId', error: 'Select the income head.' }
  const bad = checkDetails(input.method, input.details)
  if (bad) return bad
  const res = await apiRequest<any>('/members/invoices/manual/', {
    method: 'POST',
    body: JSON.stringify({
      member: input.memberId,
      head: input.headId,
      amount: input.amount.toFixed(2),
      description: input.description.trim(),
      ...paymentBody(input.method, input.details),
    }),
  })
  if (res.error) {
    const fail = failure(res)
    return fail.field === 'typeId' ? { ...fail, field: 'headId' } : fail
  }
  const added = (res.data.invoices as any[]).map(toInvoice)
  commit({ ...db, invoices: [...db.invoices.filter((i) => !added.some((a) => a.id === i.id)), ...added] })
  return { id: res.data.receipt }
}

/* ---------- payment requests ---------- */

/**
 * Sends a request from a chapter's office bearer: every chosen member gets an invoice that shows up in their Dues, on any
 * device. A recurring request creates one invoice per date between `from` and `to`, due on that date, for active members only.
 * The server numbers the invoices from the chapter's financial year settings.
 */
export async function createPaymentRequest(input: {
  regionId: string
  chapterId: string
  typeId: string
  amount: number
  description: string
  dueDate: string
  memberIds: string[]
  recurrence?: { every: Recurrence; from: string; to: string }
}): Promise<ActionResult> {
  if (!db.accountHeads.some((h) => h.id === input.typeId)) return { field: 'typeId', error: 'Choose a request type.' }
  const res = await apiRequest<any>('/members/payment-requests/', {
    method: 'POST',
    body: JSON.stringify({
      chapter: input.chapterId,
      head: input.typeId,
      amount: input.amount.toFixed(2),
      description: input.description.trim(),
      due_date: input.recurrence ? null : input.dueDate || null,
      member_ids: input.memberIds,
      recurrence: input.recurrence ?? null,
    }),
  })
  if (res.error) return failure(res)

  const invoices = await apiRequest<any[]>('/members/invoices/')
  commit({
    ...db,
    requests: [toRequest(res.data), ...db.requests.filter((r) => r.id !== res.data.id)],
    invoices: invoices.data && Array.isArray(invoices.data) ? invoices.data.map(toInvoice) : db.invoices,
  })
  return { id: res.data.id }
}

/**
 * Edits a payment request already sent: its type, amount, description, due date and members. The server changes the invoices
 * that are still due; one already paid (or waiting to be verified) keeps what it was paid for, and its member cannot be taken off.
 * A recurring request keeps its schedule, so its due date is not sent.
 */
export async function updatePaymentRequest(
  id: string,
  input: { typeId: string; amount: number; description: string; dueDate: string; memberIds: string[]; recurring: boolean },
): Promise<ActionResult> {
  if (!db.accountHeads.some((h) => h.id === input.typeId)) return { field: 'typeId', error: 'Choose a request type.' }
  const res = await apiRequest<any>(`/members/payment-requests/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      head: input.typeId,
      amount: input.amount.toFixed(2),
      description: input.description.trim(),
      member_ids: input.memberIds,
      ...(input.recurring ? {} : { due_date: input.dueDate || null }),
    }),
  })
  if (res.error) return failure(res)

  const invoices = await apiRequest<any[]>('/members/invoices/')
  commit({
    ...db,
    requests: db.requests.map((r) => (r.id === id ? toRequest(res.data) : r)),
    invoices: invoices.data && Array.isArray(invoices.data) ? invoices.data.map(toInvoice) : db.invoices,
  })
  return { id }
}

/**
 * Takes back a payment the chapter received: a request payment goes back to Due (dues paid together go back together) and a
 * payment recorded by hand is removed. Allowed for the head table; the server decides.
 */
export async function undoMemberPayment(invoiceId: string): Promise<ActionResult> {
  const res = await apiRequest<any>('/members/invoices/undo-payment/', { method: 'POST', body: JSON.stringify({ invoice_id: invoiceId }) })
  if (res.error) return failure(res)
  const gone = new Set<string>(res.data.removed)
  const back = new Map((res.data.invoices as any[]).map((r) => [r.id as string, toInvoice(r)]))
  commit({ ...db, invoices: db.invoices.filter((i) => !gone.has(i.id)).map((i) => back.get(i.id) ?? i) })
  return {}
}

/** Takes back the fee a visitor paid when registering. The visitor stays registered but is no longer marked as paid. */
export async function undoVisitorPayment(id: string): Promise<ActionResult> {
  const res = await apiRequest(`/members/visitor-payments/${id}/`, { method: 'DELETE' })
  if (res.error) return failure(res)
  commit({ ...db, visitorPayments: (db.visitorPayments || []).filter((v) => v.id !== id) })
  return {}
}

/** Deletes a payment request and its invoices. The server allows it only while nobody has paid against it. */
export async function deletePaymentRequest(id: string): Promise<ActionResult> {
  const res = await apiRequest(`/members/payment-requests/${id}/`, { method: 'DELETE' })
  if (res.error) return failure(res)
  commit({ ...db, requests: db.requests.filter((r) => r.id !== id), invoices: db.invoices.filter((i) => i.requestId !== id) })
  return {}
}

/* ---------- polls ---------- */

export async function createPoll(input: { regionId: string; chapterId: string; question: string; description?: string; image?: string; multiple: boolean; options: string[] }): Promise<ActionResult> {
  const res = await apiRequest<any>('/chapters/polls/', {
    method: 'POST',
    body: JSON.stringify({
      region: input.regionId,
      chapter: input.chapterId,
      question: input.question.trim(),
      description: input.description?.trim() ?? '',
      image: input.image ?? '',
      multiple: input.multiple,
      option_texts: input.options.map((t) => t.trim()).filter(Boolean),
    }),
  })

  if (res.error) return { error: res.error }

  const poll = toPoll(res.data)
  commit({ ...db, polls: [...db.polls, poll] })
  return { id: poll.id }
}

export async function setPollClosed(id: string, closed: boolean) {
  await apiRequest(`/chapters/polls/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ closed }),
  })
  commit({ ...db, polls: db.polls.map((p) => (p.id === id ? { ...p, closed } : p)) })
}

export async function deletePoll(id: string) {
  await apiRequest(`/chapters/polls/${id}/`, { method: 'DELETE' })
  commit({ ...db, polls: db.polls.filter((p) => p.id !== id), votes: db.votes.filter((v) => v.pollId !== id) })
}

/** Records the member's answer, replacing an earlier one. Radio polls take one option, checkbox polls one or more. */
export async function submitVote(memberId: string, pollId: string, optionIds: string[]): Promise<ActionResult> {
  const poll = db.polls.find((p) => p.id === pollId)
  if (!poll) return { error: 'Poll not found.' }

  const res = await apiRequest<any>(`/chapters/polls/${pollId}/vote/`, {
    method: 'POST',
    body: JSON.stringify({ option_ids: optionIds }),
  })

  if (res.error) return { error: res.error }

  /* Read the poll again so the counts include this vote. */
  const fresh = await apiRequest<any[]>('/chapters/polls/')
  if (fresh.data && Array.isArray(fresh.data)) {
    commit({ ...db, polls: fresh.data.map(toPoll), votes: fresh.data.flatMap(toVotes) })
  } else {
    const vote = { id: res.data?.id || uid('v'), pollId, memberId, optionIds, at: iso() }
    commit({ ...db, votes: [...db.votes.filter((v) => !(v.pollId === pollId && v.memberId === memberId)), vote] })
  }
  return { id: res.data?.id }
}
