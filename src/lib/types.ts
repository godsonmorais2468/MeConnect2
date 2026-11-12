/** Glossy tile colour families, defined as `.t-<tone>` in index.css. */
export type Tone = 'red' | 'gold' | 'navy' | 'green' | 'steel' | 'wine'

export type Role = 'super_admin' | 'region_admin' | 'member'
export type Mode = 'monthly' | 'tenure'
export type Married = 'yes' | 'no' | ''
export type ProfileState = 'pending' | 'saved' | 'skipped'

export const PLAN_SCOPES = ['region', 'chapter', 'member'] as const
export type PlanScope = (typeof PLAN_SCOPES)[number]

export const BILLING_CYCLES = ['one_time', 'monthly', 'quarterly', 'half_yearly', 'yearly'] as const
export type BillingCycle = (typeof BILLING_CYCLES)[number]

export interface Region {
  id: string
  /** Short region code, e.g. KER-01. */
  code?: string
  name: string
  adminName: string
  adminMobile: string
  email?: string
  adminPin: string
  subscriptionStartDate?: string
  subscriptionEndDate?: string
  subscriptionGrandfathered?: boolean
  maxChapters?: number
  isActive?: boolean
  createdAt: string
}

export interface ApplicablePlan {
  id: string
  name: string
  description?: string
  scope_type: 'region' | 'chapter' | 'member'
  billing_cycle: BillingCycle
  rate: string
  tax_percent: string
  base_amount: string
  tax_amount: string
  total_amount: string
  currency?: string
  region_id?: string | null
  region_name?: string | null
  chapter_id?: string | null
  chapter_name?: string | null
  member_id?: string | null
}

/** The effective region access state returned by /subscriptions/current/. */
export interface SubscriptionStatus {
  allowed: boolean
  code: string | null
  state: string
  source: string
  message: string
  as_of: string
  billing_allowed: boolean
  region: {
    id: string
    name: string
    is_active: boolean
    grandfathered: boolean
    legacy_start_date: string | null
    legacy_end_date: string | null
  } | null
  subscription: {
    id: string
    status: string
    plan_id?: string | null
    plan?: string | null
    plan_name: string
    billing_cycle: string
    scope_type?: 'region' | 'chapter' | 'member'
    base_amount?: string
    tax_percent?: string
    tax_amount?: string
    total_amount?: string
    currency?: string
    chapter_name?: string | null
    member_name?: string | null
    start_date: string | null
    current_period_start: string | null
    current_period_end: string | null
    grace_period_end: string | null
  } | null
  plan?: ApplicablePlan | null
}

/** A plan assigned to a region, chapter or member. Pending subscriptions do not grant access. */
export interface SubscriptionRecord {
  id: string
  plan: string
  plan_name: string
  plan_billing_cycle: BillingCycle
  scope_type: PlanScope
  region: string | null
  region_name: string
  chapter: string | null
  chapter_name: string
  member_profile: string | null
  member_name: string
  purchased_by: string | null
  purchased_by_name: string
  status: string
  start_date: string | null
  current_period_start: string | null
  current_period_end: string | null
  grace_period_end: string | null
  base_amount: string
  tax_percent: string
  tax_amount: string
  total_amount: string
  currency: string
  cancelled_at: string | null
  cancellation_reason: string
  latest_payment_status: string | null
  latest_payment_verified_at: string | null
  latest_payment_txn_id: string | null
  latest_payment_gateway_id: string | null
  created_at: string
  updated_at: string
}

/** Standard DRF paginated response. */
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/** A manual or gateway payment recorded against a subscription. */
export interface SubscriptionPayment {
  id: string
  subscription?: string | null
  plan?: string | null
  plan_name?: string
  plan_billing_cycle?: string
  scope_type?: string
  status: string
  merchant_txn_id?: string
  gateway_payment_id?: string
  base_amount: string
  tax_amount: string
  total_amount: string
  currency: string
  initiated_at?: string | null
  verified_at?: string | null
  failed_at?: string | null
  failure_reason?: string
  error_code?: string
  region?: string | null
  region_id?: string | null
  region_name?: string
  chapter?: string | null
  chapter_id?: string | null
  chapter_name?: string
  member_profile?: string | null
  member_name?: string
  created_by?: string | null
  created_by_name?: string
  created_by_mobile?: string
  created_at: string
  updated_at: string
}

export interface Plan {
  id: string
  name: string
  description: string
  /** Who the plan is sold to. */
  scopeType: PlanScope
  /** The period the rate covers. Existing plans are monthly. */
  billingCycle: BillingCycle
  /** Rate for the selected billing cycle, before tax. */
  rate: number
  taxPercent: number
  /** Empty = open to every region. */
  regionId?: string
  /** Empty = open to every chapter of the region. */
  chapterId?: string
  /** Only set for a single-member plan; the MemberProfile id. */
  memberId?: string
  /** Whether the plan is eligible for deletion (no active subscriptions or verified payments). */
  canDelete?: boolean
  /** IDs of regions assigned to this plan. */
  applicableRegions?: string[]
  /** Names of regions assigned to this plan. */
  applicableRegionNames?: string[]
}

/** Settings > Due List, when it is on: the 21st-of-the-month default or by due date. */
export type DueListMode = 'default' | 'due_date'

/** The Due List: members with dues to pay, as the server lists them for the chapter. */
export interface DueListData {
  enabled: boolean
  mode: DueListMode
  /** The day of the month a due joins the list under the default way of listing. */
  day: number
  members: {
    /** The member record id. */
    member: string
    memberName: string
    total: number
    dues: { id: string; label: string; amount: number; dueDate: string; overdue: boolean }[]
  }[]
}

/** One member's line in the App Usage Report: a yes or no for each thing. */
export interface AppUsageRow {
  member: string
  name: string
  designation: string
  signedUp: boolean
  profileComplete: boolean
  attended: boolean
  voted: boolean
  /** Has paid a due from the app at least once. */
  paid: boolean
}

/** The App Usage Report of the head table's chapter. */
export interface AppUsageData {
  members: AppUsageRow[]
}

/** One chapter's line in the Super Admin's App Usage summary: how many of its members have done each thing. */
export interface AppUsageChapter {
  chapter: string
  name: string
  code: string
  isActive: boolean
  region: string
  regionName: string
  regionCode: string
  members: number
  signedUp: number
  profileComplete: number
  attended: number
  voted: number
  paid: number
}

export interface Chapter {
  id: string
  regionId: string
  /** Short chapter code, e.g. TVM-01. */
  code?: string
  name: string
  city: string
  /** Chapter logo as an image data URL. */
  logo?: string
  /** The name of the file the logo was uploaded from. */
  logoName?: string
  description?: string
  /** Inactive chapters are hidden from sign-up and take no new members. */
  isActive?: boolean
  /** Where this chapter's dues are paid: UPI ID (VPA) and the name shown to the payer. */
  upiId?: string
  upiName?: string
  /** Settings > Due List: switched on or off by the head table, and which way of listing is chosen. */
  dueListEnabled?: boolean
  dueListMode?: DueListMode
  createdAt: string
}

/** A role a member can hold. Each region keeps its own list. */
export interface Designation {
  id: string
  regionId: string
  name: string
  description: string
  isHeadTable: boolean
  isLeadershipTeam: boolean
  /** Someone with this designation can also be added to other chapters and sign in to each with the same login. */
  multiChapterLogin?: boolean
  /** Someone with this designation can be added to other chapters and listed there, but cannot sign in to them. */
  multiChapterAddOnly?: boolean
  permissions?: string[]
  isActive: boolean
  /** A designation only one chapter has (added by its head table). Empty for the region's and the defaults'. */
  chapterId?: string
  /** A region's own version of a default: the default's id. It replaces that default in this region only. */
  sourceId?: string
  /** With `sourceId`: the region has removed the default, so it no longer shows or applies there. */
  hidden?: boolean
  createdAt: string
}

export interface Profile {
  email: string
  website: string
  social: string
  dob: string
  married: Married
  anniversary: string
  spouse: string
  /** YYYY-MM-DD: the day the member joined ME-CONNECT. */
  dateOfJoining: string
}

export interface Member {
  id: string
  regionId: string
  chapterId: string
  planId: string
  mode: Mode
  amount: number
  designation: string
  name: string
  mobile: string
  pin: string
  organisation: string
  category: string
  photo: string
  /** False when the login is switched off from the Chapter Team menu. */
  isActive?: boolean
  /** False: only listed in this chapter (added from another one under Multiple Chapter Add Only); no sign in here. */
  loginEnabled?: boolean
  /** For a listed-only person: the chapter they sign in to. */
  homeChapterName?: string
  createdAt: string
  profile: Profile
  profileState: ProfileState
}

export type MeetingMode = 'online' | 'offline'
/** Who a meeting is for: every member, the members holding chosen designations, or chosen members. */
export type MeetingAudience = 'all' | 'designations' | 'members'
export type AttendanceMethod = 'online' | 'qr' | 'geofence' | 'substitute' | 'manual'

export interface Meeting {
  id: string
  regionId: string
  chapterId: string
  title: string
  mode: MeetingMode
  /** ISO date-time the meeting starts. */
  startsAt: string
  durationMin: number
  /** Offline meetings only: where it is held and the geofence around it. */
  venue: string
  lat: number | null
  lng: number | null
  /** Members must be within this many metres of the venue to mark attendance by location. */
  radiusM: number
  audience: MeetingAudience
  /** With audience 'designations': the designation names. */
  audienceDesignations: string[]
  /** With audience 'members': the members chosen. */
  inviteeIds: string[]
  /** Everyone the meeting is for, as the server works it out (the head table is always in). */
  invitedIds: string[]
  createdAt: string
}

export interface Visitor {
  id: string
  chapterId: string
  meetingId: string
  invitedById?: string
  name: string
  company: string
  category?: string
  phone: string
  email?: string
  notes?: string
  createdAt: string
}

export interface Substitute {
  id: string
  chapterId: string
  meetingId: string
  memberId: string
  substituteName: string
  substituteCompany?: string
  substitutePhone?: string
  substituteEmail?: string
  notes?: string
  createdAt: string
}

export interface Attendance {
  id: string
  meetingId: string
  memberId: string
  method: AttendanceMethod
  at: string
  /** Metres from the venue, when marked by location. */
  distanceM?: number
}

export type PayMethod = 'UPI' | 'Cheque' | 'Cash'

/** One amount a member owes, and later how it was paid. */
export interface Invoice {
  id: string
  /** Invoice number shown to people, e.g. INV-2026-00012. */
  no?: string
  /** When the invoice was raised (ISO). */
  issuedAt?: string
  memberId: string
  label: string
  amount: number
  /** YYYY-MM-DD, or empty when the request has no due date. */
  dueDate: string
  /** `pending`: the member has paid and the chapter has not yet verified it (Payment Verifications). */
  status: 'due' | 'pending' | 'paid'
  paidAt?: string
  /** When the chapter verified the payment (ISO). */
  verifiedAt?: string
  method?: PayMethod
  /** The mode of pay as named in the chapter's Mode of Pay list (Accounts). `method` is the kind it counts as. */
  modeName?: string
  /** Receipt number, once paid. */
  ref?: string
  /** What it is for (the request type). Plain membership invoices leave this empty. */
  kind?: string
  /** Set when the admin sent this as a payment request. */
  requestId?: string
  /** Settled together with the rest of its recurring request in one payment (shares one receipt number). */
  payAll?: boolean
  description?: string
  /** UPI payments: transaction ID and the date it was made (YYYY-MM-DD). */
  txnId?: string
  txnDate?: string
  /** Cheque payments: cheque number and the date on the cheque (YYYY-MM-DD). */
  chequeNo?: string
  chequeDate?: string
}

/** A kind of payment a chapter can ask for, with its usual amount. */
export interface RequestType {
  id: string
  chapterId: string
  name: string
  amount: number
}

/** One payment request sent to a group of members. Each member gets their own invoice. */
export type Recurrence = 'daily' | 'weekly' | 'monthly'

export interface PaymentRequest {
  id: string
  regionId: string
  chapterId: string
  typeId: string
  typeName: string
  amount: number
  description: string
  /** YYYY-MM-DD, or empty when there is no due date. */
  dueDate: string
  memberIds: string[]
  /** Set for a recurring request: one due per date in `dates`. */
  /* `dates` is the whole schedule; invoices exist only for the dates up to `generatedThrough` (each is made on its day). */
  recurrence?: { every: Recurrence; from: string; to: string; dates: string[]; generatedThrough?: string }
  createdAt: string
}

export interface PollOption {
  id: string
  text: string
}

/** A question the region admin asks a chapter. One answer (radio buttons) or several (checkboxes). */
export interface Poll {
  id: string
  regionId: string
  chapterId: string
  question: string
  /** Optional: what the poll is about, any length. */
  description?: string
  /** Optional: an image shown with the poll (a data URL). */
  image?: string
  multiple: boolean
  options: PollOption[]
  closed: boolean
  createdAt: string
  /** From the server: how many members picked each option, and how many answered at all. */
  counts?: Record<string, number>
  voters?: number
}

export interface Vote {
  id: string
  pollId: string
  memberId: string
  optionIds: string[]
  at: string
}

export type HeadType = 'income' | 'expense'

export interface AccountHead {
  id: string
  regionId: string
  chapterId: string
  headType: HeadType
  name: string
  comment: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ModeOfPay {
  id: string
  regionId: string
  chapterId: string
  name: string
  code: string
  description: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface FinancialYear {
  id: string
  regionId: string
  chapterId: string
  title: string
  startDate: string
  endDate: string
  billStartNumber: number
  invoicePrefix?: string
  invoiceStartNumber?: number
  receiptPrefix?: string
  receiptStartNumber?: number
  voucherPrefix?: string
  voucherStartNumber?: number
  isCurrent: boolean
  isLocked: boolean
  createdAt?: string
  updatedAt?: string
}

export interface BankMaster {
  id: string
  regionId: string
  chapterId: string
  bankName: string
  accountName: string
  accountNumber: string
  ifscCode: string
  branch: string
  upiId: string
  openingBalance: number
  isDefault: boolean
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

/** Payment voucher = an expense the chapter paid. Receipt voucher = income the chapter received. */
export type VoucherKind = 'payment' | 'receipt'

export interface Voucher {
  id: string
  regionId: string
  chapterId: string
  financialYearId: string
  financialYearTitle: string
  kind: VoucherKind
  /** Assigned by the server from the financial year settings. */
  number: string
  /** YYYY-MM-DD */
  date: string
  headId: string
  headName: string
  amount: number
  modeName: string
  /** What the voucher is for. Required on new vouchers; older ones may have none. */
  remarks: string
  createdAt?: string
}

/** The fee a visitor paid when registering (mode of pay and amount), listed in Payment Verifications as already paid. */
export interface VisitorPayment {
  id: string
  chapterId: string
  visitorName: string
  visitorPhone: string
  referredByName: string
  mode: string
  amount: number
  /** The receipt number the financial year settings gave it. */
  receipt: string
  paidAt: string
  reference: string
}

export interface DB {
  regions: Region[]
  plans: Plan[]
  chapters: Chapter[]
  designations: Designation[]
  members: Member[]
  meetings: Meeting[]
  attendance: Attendance[]
  invoices: Invoice[]
  requestTypes: RequestType[]
  requests: PaymentRequest[]
  polls: Poll[]
  votes: Vote[]
  accountHeads: AccountHead[]
  paymentModes: ModeOfPay[]
  financialYears: FinancialYear[]
  bankAccounts: BankMaster[]
  vouchers: Voucher[]
  visitorPayments: VisitorPayment[]
  visitors?: Visitor[]
  substitutes?: Substitute[]
}

export interface Session {
  role: Role
  id: string
}

/** One chapter a person is a member of. The same mobile number and PIN open all of them. */
export interface Membership {
  /** The member record in that chapter (the session id while acting in it). */
  memberId: string
  chapterId: string
  chapterName: string
  regionName: string
  designation: string
}
