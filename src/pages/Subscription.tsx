import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Clock,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Filter,
  Lock,
  LogOut,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  X,
} from 'lucide-react'
import { BrandMark, Glyph } from '../components/ui'
import { useAuth } from '../lib/auth'
import { apiRequest } from '../lib/api'
import { HOME } from '../data/nav'
import { SUPPORT_EMAIL, SUPPORT_PHONES } from '../data/support'
import { fmtDate, fmtTime, inr } from '../lib/format'
import {
  fetchSubscriptionPayments,
  fetchSubscriptionStatus,
  initiateEasebuzzPayment,
  paymentCount,
  paymentList,
  verifyEasebuzzPayment,
} from '../lib/subscription'
import { signOut } from '../lib/store'
import { useToast } from '../lib/toast'
import type { SubscriptionPayment, SubscriptionStatus } from '../lib/types'

function sourceLabel(source: string) {
  if (source === 'subscription') return 'Paid subscription'
  if (source === 'grandfathered') return 'Exempt from subscription'
  if (source === 'legacy') return 'Legacy subscription dates'
  if (source === 'super_admin') return 'Super Admin'
  if (source === 'plan') return 'Applicable plan'
  return 'No active plan'
}

function statusLabel(status: string | null | undefined) {
  if (!status) return 'Not active'
  return status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function paymentWhen(payment: SubscriptionPayment) {
  return payment.verified_at || payment.initiated_at || payment.created_at
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return 'N/A'
  const date = fmtDate(iso)
  const time = fmtTime(iso)
  if (date && time) return `${date}, ${time}`
  return date || time || 'N/A'
}

export default function Subscription() {
  const auth = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const isRegionAdmin = auth.role === 'region_admin' || auth.role === 'super_admin'

  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [payments, setPayments] = useState<SubscriptionPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')

  // Pagination & Filtering state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [chapterFilter, setChapterFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const paymentQuery = searchParams.get('payment')
  const txnidQuery = searchParams.get('txnid')
  const msgQuery = searchParams.get('msg')

  // Load chapters for Region Admin filter
  useEffect(() => {
    if (!isRegionAdmin) return
    let active = true
    apiRequest<any[]>('/chapters/').then((res) => {
      if (!active || !res.data || !Array.isArray(res.data)) return
      setChapters(
        res.data.map((ch: any) => ({
          id: String(ch.id),
          name: ch.name || 'Unnamed Chapter',
        }))
      )
    })
    return () => {
      active = false
    }
  }, [isRegionAdmin])

  // Load base subscription status
  useEffect(() => {
    let active = true
    async function loadStatus() {
      setLoading(true)
      setError('')

      // If returning with txnid, verify payment status first
      if (txnidQuery && (paymentQuery === 'success' || paymentQuery === 'pending' || paymentQuery === 'dropped')) {
        try {
          await verifyEasebuzzPayment(txnidQuery)
        } catch {
          // Fall through to status check
        }
      }

      const statusRes = await fetchSubscriptionStatus()
      if (!active) return

      if (statusRes.status === 401) {
        signOut()
        navigate('/login', { replace: true })
        return
      }

      if (!statusRes.data) {
        setError(statusRes.error || 'Could not check the subscription status.')
        setLoading(false)
        return
      }

      setStatus(statusRes.data)
      setLoading(false)
    }

    loadStatus()
    return () => {
      active = false
    }
  }, [navigate, reloadKey, paymentQuery, txnidQuery])

  // Load paginated payment history
  useEffect(() => {
    let active = true
    setHistoryLoading(true)
    fetchSubscriptionPayments({
      page,
      pageSize,
      chapter: chapterFilter,
      status: statusFilter,
      search: searchQuery,
    }).then((res) => {
      if (!active) return
      if (res.data) {
        setPayments(paymentList(res.data))
        setTotalCount(paymentCount(res.data))
      }
      setHistoryLoading(false)
    })
    return () => {
      active = false
    }
  }, [page, pageSize, chapterFilter, statusFilter, searchQuery, reloadKey])

  function leave() {
    signOut()
    navigate('/login', { replace: true })
  }

  function clearBanner() {
    searchParams.delete('payment')
    searchParams.delete('txnid')
    searchParams.delete('msg')
    setSearchParams(searchParams, { replace: true })
  }

  async function handlePayNow() {
    const applicablePlan = status?.plan
    const existingSub = status?.subscription
    const planId = applicablePlan?.id || (existingSub as any)?.plan_id || (existingSub as any)?.plan || ''
    const subscriptionId = existingSub?.id

    if (!planId && !subscriptionId) {
      toast('No applicable plan found for checkout.', 'info')
      return
    }

    setPaying(true)
    setPayError('')

    const res = await initiateEasebuzzPayment({
      planId,
      subscriptionId,
      scopeType: applicablePlan?.scope_type || existingSub?.scope_type || 'region',
      regionId: status?.region?.id,
    })

    if (!res.data || !res.data.success || !res.data.payment_url) {
      const err = res.error || res.data?.error || 'Could not initiate payment. Please try again.'
      setPayError(err)
      toast(err, 'info')
      setPaying(false)
      return
    }

    // Redirect to Easebuzz checkout
    window.location.href = res.data.payment_url
  }

  const backTo = auth.role ? HOME[auth.role] : '/login'
  const region = status?.region
  const sub = status?.subscription
  const plan = status?.plan

  const scope = plan?.scope_type || sub?.scope_type || 'region'

  const isRestricted = !status?.allowed && status?.billing_allowed === false

  const pageTitle = isRestricted
    ? 'Access Restricted'
    : scope === 'member'
    ? 'Member subscription'
    : scope === 'chapter'
    ? 'Chapter subscription'
    : 'Region subscription'

  const bannerTitle = status?.allowed
    ? scope === 'member'
      ? 'Your membership is active'
      : scope === 'chapter'
      ? 'Your chapter is active'
      : 'Your region is active'
    : isRestricted
    ? 'Access Restricted'
    : 'Subscription required'

  const activePlanName = sub?.plan_name || plan?.name || 'Standard Plan'
  const activeCycle = sub?.billing_cycle || plan?.billing_cycle || 'monthly'
  const baseRate = plan?.base_amount || (plan?.rate ? String(plan.rate) : sub?.base_amount)
  const gstRate = plan?.tax_amount || sub?.tax_amount
  const taxPct = plan?.tax_percent || sub?.tax_percent || '18.00'
  const totalAmount = plan?.total_amount || sub?.total_amount

  const canPay = !status?.allowed && status?.billing_allowed !== false && (plan != null || sub != null)

  return (
    <>
      <div className="policy">
        <article className="policy__card sub">
          <header className="policy__head">
            <BrandMark size={52} />
            <div>
              <span>ME-CONNECT</span>
              <h1>{pageTitle}</h1>
            </div>
          </header>

          {loading ? (
            <div className="empty">
              <b>Checking your subscription</b>
              Reading the latest status from the server.
            </div>
          ) : error ? (
            <div className="form-error">
              {error}
              <button className="link-btn" type="button" onClick={() => setReloadKey((n) => n + 1)}>
                Try again
              </button>
            </div>
          ) : status ? (
            <>
              {/* Gateway Return Feedback Banners */}
              {paymentQuery === 'success' && (
                <section className="state state--ok sub__state">
                  <Glyph icon={CheckCircle2} tone="green" size={54} />
                  <div>
                    <h2>Payment successful!</h2>
                    <p>
                      Your transaction {txnidQuery ? `(${txnidQuery})` : ''} has been verified and your
                      subscription is now active.
                    </p>
                  </div>
                  <button className="btn btn--primary" type="button" onClick={clearBanner}>
                    Continue
                  </button>
                </section>
              )}

              {paymentQuery === 'failed' && (
                <section className="state state--go sub__state">
                  <Glyph icon={AlertCircle} tone="red" size={54} />
                  <div>
                    <h2>Payment unsuccessful</h2>
                    <p>{msgQuery ? decodeURIComponent(msgQuery) : 'The payment was not completed or was cancelled. You can retry below.'}</p>
                  </div>
                  <button className="btn btn--line" type="button" onClick={clearBanner}>
                    Dismiss
                  </button>
                </section>
              )}

              {(paymentQuery === 'pending' || paymentQuery === 'dropped') && (
                <section
                  className="state sub__state"
                  style={{
                    background: 'rgba(234, 179, 8, 0.08)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: 16,
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <Glyph icon={Clock} tone="gold" size={54} />
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 4px', color: '#854d0e' }}>
                      Payment Pending Verification
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#713f12' }}>
                      {msgQuery
                        ? decodeURIComponent(msgQuery)
                        : `Your transaction ${txnidQuery ? `(${txnidQuery})` : ''} is awaiting bank/gateway confirmation. If money was debited, your subscription will be activated automatically once confirmed.`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn--primary btn--sm" type="button" onClick={() => setReloadKey((n) => n + 1)}>
                      Check Status
                    </button>
                    <button className="btn btn--line btn--sm" type="button" onClick={clearBanner}>
                      Dismiss
                    </button>
                  </div>
                </section>
              )}

              {paymentQuery === 'refunded' && (
                <section
                  className="state sub__state"
                  style={{
                    background: 'rgba(100, 116, 139, 0.08)',
                    border: '1px solid rgba(100, 116, 139, 0.3)',
                    borderRadius: 16,
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <Glyph icon={AlertCircle} tone="navy" size={54} />
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 4px', color: '#1e293b' }}>
                      Payment Refunded
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155' }}>
                      Transaction {txnidQuery ? `(${txnidQuery})` : ''} has been refunded. Any related active subscription has been cancelled.
                    </p>
                  </div>
                  <button className="btn btn--line btn--sm" type="button" onClick={clearBanner}>
                    Dismiss
                  </button>
                </section>
              )}

              {isRestricted ? (
                /* Elegant, dedicated Restricted View (no internal plan terms, rates, or scope jargon) */
                <section
                  className="sub__restricted-card"
                  style={{
                    background: 'linear-gradient(135deg, rgba(13, 110, 97, 0.04) 0%, #ffffff 100%)',
                    borderRadius: 20,
                    border: '1px solid rgba(13, 110, 97, 0.14)',
                    padding: '40px 28px',
                    textAlign: 'center',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.03)',
                    margin: '16px 0 24px',
                  }}
                >
                  <div
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(13, 110, 97, 0.12) 0%, rgba(13, 110, 97, 0.04) 100%)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent, #0D6E61)',
                      marginBottom: 20,
                      boxShadow: '0 4px 14px rgba(13, 110, 97, 0.08)',
                    }}
                  >
                    <Lock size={32} />
                  </div>

                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--ink, #1f2937)',
                      margin: '0 0 12px',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {status?.code === 'chapter_subscription_required' || status?.state === 'chapter_subscription_required'
                      ? 'Chapter Subscription Pending Activation'
                      : 'Action Required by Region Administrator'}
                  </h2>

                  <p
                    style={{
                      fontSize: 15,
                      lineHeight: 1.6,
                      color: 'var(--ink-soft, #4b5563)',
                      maxWidth: 520,
                      margin: '0 auto 22px',
                    }}
                  >
                    {status?.code === 'chapter_subscription_required' || status?.state === 'chapter_subscription_required'
                      ? (status.message || "Your chapter's subscription is currently pending activation. Please contact your Chapter Head or administrator for assistance.")
                      : (
                        <>
                          Your organization's subscription is managed at the regional level. Please contact your{' '}
                          <strong style={{ color: 'var(--ink, #1f2937)' }}>Region Administrator</strong> to activate access for your chapter.
                        </>
                      )}
                  </p>

                  {/* Clean context pill without internal jargon */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      padding: '10px 18px',
                      background: 'rgba(0, 0, 0, 0.03)',
                      borderRadius: 14,
                      marginBottom: 24,
                    }}
                  >
                    {(auth.chapter?.name || sub?.chapter_name) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink)' }}>
                        <span style={{ color: 'var(--ink-mute)' }}>Chapter:</span>
                        <b>{auth.chapter?.name || sub?.chapter_name}</b>
                      </div>
                    )}
                    {(auth.chapter?.name || sub?.chapter_name) && (region?.name || auth.region?.name) && (
                      <span style={{ color: 'var(--line, #e5e7eb)' }}>•</span>
                    )}
                    {(region?.name || auth.region?.name) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink)' }}>
                        <span style={{ color: 'var(--ink-mute)' }}>Region:</span>
                        <b>{region?.name || auth.region?.name}</b>
                      </div>
                    )}
                    <span style={{ color: 'var(--line, #e5e7eb)' }}>•</span>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: 'rgba(234, 88, 12, 0.1)',
                        color: '#c2410c',
                      }}
                    >
                      Awaiting Region Activation
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '14px 20px',
                      background: 'rgba(13, 110, 97, 0.04)',
                      borderRadius: 12,
                      border: '1px dashed rgba(13, 110, 97, 0.22)',
                      maxWidth: 520,
                      margin: '0 auto 26px',
                      fontSize: 13,
                      color: 'var(--ink-soft, #4b5563)',
                      lineHeight: 1.5,
                    }}
                  >
                    Access will be automatically unlocked for all chapter members once your Region Administrator completes the activation.
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => setReloadKey((n) => n + 1)}
                      style={{ padding: '10px 22px', fontSize: 14 }}
                    >
                      <RefreshCw size={15} /> Check status again
                    </button>
                    <button
                      type="button"
                      className="btn btn--line"
                      onClick={leave}
                      style={{ padding: '10px 22px', fontSize: 14 }}
                    >
                      <LogOut size={15} /> Sign out
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  {/* Main Status Hero */}
                  <section className={`state ${status.allowed ? 'state--ok' : 'state--go'} sub__state`}>
                    <Glyph
                      icon={status.allowed ? ShieldCheck : CreditCard}
                      tone={status.allowed ? 'green' : 'red'}
                      size={54}
                    />
                    <div>
                      <h2>{bannerTitle}</h2>
                      <p>{status.message}</p>
                    </div>
                    {status.allowed && (
                      <Link className="btn btn--primary" to={backTo}>
                        <ArrowLeft size={16} /> Back to app
                      </Link>
                    )}
                  </section>

                  {/* Pay Now Section for Blocked Users */}
                  {canPay && (
                    <section className="sub__card" style={{ marginBottom: 16, borderColor: 'var(--accent, #0D6E61)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div>
                          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--ink)' }}>Activate Subscription</h2>
                          <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                            Instant activation via Easebuzz secure payment gateway
                          </span>
                        </div>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: 'rgba(13, 110, 97, 0.1)',
                            color: 'var(--accent, #0D6E61)',
                          }}
                        >
                          Payment Required
                        </span>
                      </div>

                      <dl className="sub__rows" style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.02)', borderRadius: 12 }}>
                        <div>
                          <dt>Selected Plan</dt>
                          <dd><b>{activePlanName}</b></dd>
                        </div>
                        <div>
                          <dt>Billing Cycle</dt>
                          <dd style={{ textTransform: 'capitalize' }}>{activeCycle.replace(/_/g, ' ')}</dd>
                        </div>
                        {baseRate && (
                          <div>
                            <dt>Base Amount</dt>
                            <dd>{inr(Number(baseRate))}</dd>
                          </div>
                        )}
                        {gstRate && (
                          <div>
                            <dt>GST ({taxPct}%)</dt>
                            <dd>{inr(Number(gstRate))}</dd>
                          </div>
                        )}
                        {totalAmount && (
                          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 4 }}>
                            <dt style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Total Payable</dt>
                            <dd style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent, #0D6E61)' }}>
                              {inr(Number(totalAmount))}
                            </dd>
                          </div>
                        )}
                      </dl>

                      {payError && <div className="form-error" style={{ marginTop: 12 }}>{payError}</div>}

                      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-mute)' }}>
                          <Lock size={14} /> 256-bit SSL encrypted checkout
                        </div>
                        <button
                          className="btn btn--primary"
                          type="button"
                          disabled={paying}
                          onClick={handlePayNow}
                          style={{ minWidth: 200, padding: '12px 24px', fontSize: 15, fontWeight: 700 }}
                        >
                          <CreditCard size={18} />
                          {paying ? 'Connecting to Easebuzz...' : `Pay ${totalAmount ? inr(Number(totalAmount)) : 'Now'}`}
                        </button>
                      </div>
                    </section>
                  )}

                  <div className="sub__grid">
                    <section className="sub__card">
                      <h2>Access details</h2>
                      <dl className="sub__rows">
                        {scope === 'member' && (
                          <div>
                            <dt>Member</dt>
                            <dd>{sub?.member_name || auth.name || 'Your account'}</dd>
                          </div>
                        )}
                        {(scope === 'member' || scope === 'chapter') && (
                          <div>
                            <dt>Chapter</dt>
                            <dd>{sub?.chapter_name || plan?.chapter_name || auth.chapter?.name || 'Your chapter'}</dd>
                          </div>
                        )}
                        <div>
                          <dt>Region</dt>
                          <dd>{region?.name || plan?.region_name || auth.region?.name || 'Your region'}</dd>
                        </div>
                        <div>
                          <dt>Scope</dt>
                          <dd style={{ textTransform: 'capitalize' }}>
                            {scope === 'chapter' ? 'Chapter (Head Table)' : scope}
                          </dd>
                        </div>
                        <div>
                          <dt>Access source</dt>
                          <dd>{sourceLabel(status.source)}</dd>
                        </div>
                        <div>
                          <dt>Access state</dt>
                          <dd>{statusLabel(status.state)}</dd>
                        </div>
                        {scope === 'region' && (
                          <div>
                            <dt>Exempt from subscription</dt>
                            <dd>{region?.grandfathered ? 'Yes' : 'No'}</dd>
                          </div>
                        )}
                      </dl>
                    </section>

                    <section className="sub__card">
                      <h2>Plan term</h2>
                      <dl className="sub__rows">
                        <div>
                          <dt>Plan</dt>
                          <dd>{activePlanName}</dd>
                        </div>
                        <div>
                          <dt>Billing cycle</dt>
                          <dd style={{ textTransform: 'capitalize' }}>{activeCycle.replace(/_/g, ' ')}</dd>
                        </div>
                        {totalAmount && (
                          <div>
                            <dt>Rate (inc. tax)</dt>
                            <dd><b>{inr(Number(totalAmount))}</b></dd>
                          </div>
                        )}
                        <div>
                          <dt>Subscription status</dt>
                          <dd>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 12,
                                fontSize: 12,
                                fontWeight: 600,
                                background: status.allowed
                                  ? 'rgba(34, 197, 94, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                                color: status.allowed ? '#15803d' : '#b91c1c',
                              }}
                            >
                              {status.allowed ? 'Active' : statusLabel(sub?.status || 'Payment required')}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt>Starts</dt>
                          <dd>
                            {sub?.start_date || sub?.current_period_start || region?.legacy_start_date
                              ? fmtDate(sub?.start_date || sub?.current_period_start || region?.legacy_start_date || '')
                              : 'Upon payment'}
                          </dd>
                        </div>
                        <div>
                          <dt>Expires</dt>
                          <dd>
                            {sub?.current_period_end || region?.legacy_end_date
                              ? fmtDate(sub?.current_period_end || region?.legacy_end_date || '')
                              : 'Calculated upon activation'}
                          </dd>
                        </div>
                      </dl>
                    </section>
                  </div>
                </>
              )}

              {/* Payment History */}
              {!isRestricted && (payments.length > 0 || isRegionAdmin) && (
                <section className="sub__card sub__payments">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isRegionAdmin ? 6 : 14, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h2 style={{ margin: 0 }}>{isRegionAdmin ? 'Payment History — Region Overview' : 'Payment history'}</h2>
                    {isRegionAdmin && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--ink-mute)' }}>
                        Comprehensive payments made across all chapters within your authorized region.
                      </p>
                    )}
                  </div>
                  {historyLoading && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--ink-mute)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Updating...
                    </span>
                  )}
                </div>

                {/* Filter bar for Region Admin */}
                {isRegionAdmin && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                      marginBottom: 10,
                      padding: '8px 10px',
                      background: 'var(--bg-subtle, rgba(0, 0, 0, 0.02))',
                      borderRadius: 'var(--radius-sm, 8px)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '1 1 160px', minWidth: 140 }}>
                      <Search size={13} style={{ color: 'var(--ink-mute)' }} />
                      <input
                        type="search"
                        placeholder="Search member, txn, plan..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setPage(1)
                        }}
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--line)',
                          background: 'var(--bg-card, #fff)',
                          color: 'var(--ink)',
                          fontSize: '0.78rem',
                          height: 30,
                        }}
                      />
                    </div>

                    {chapters.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 130 }}>
                        <Building2 size={13} style={{ color: 'var(--ink-mute)' }} />
                        <select
                          value={chapterFilter}
                          onChange={(e) => {
                            setChapterFilter(e.target.value)
                            setPage(1)
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--line)',
                            background: 'var(--bg-card, #fff)',
                            color: 'var(--ink)',
                            fontSize: '0.78rem',
                            height: 30,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="all">All Chapters ({chapters.length})</option>
                          {chapters.map((ch) => (
                            <option key={ch.id} value={ch.id}>
                              {ch.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Filter size={13} style={{ color: 'var(--ink-mute)' }} />
                      <select
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(e.target.value)
                          setPage(1)
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--line)',
                          background: 'var(--bg-card, #fff)',
                          color: 'var(--ink)',
                          fontSize: '0.78rem',
                          height: 30,
                          cursor: 'pointer',
                        }}
                      >
                        <option value="all">All Statuses</option>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="dropped">Dropped</option>
                        <option value="refunded">Refunded</option>
                        <option value="failed">Failed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    {(chapterFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim() !== '') && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          setChapterFilter('all')
                          setStatusFilter('all')
                          setSearchQuery('')
                          setPage(1)
                        }}
                        style={{
                          padding: '4px 7px',
                          fontSize: '0.76rem',
                          color: 'var(--ink-mute)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          height: 30,
                        }}
                      >
                        <X size={12} /> Clear
                      </button>
                    )}
                  </div>
                )}

                {/* Payments List */}
                {historyLoading && !payments.length ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: '0.82rem' }}>
                    Loading payment records...
                  </div>
                ) : payments.length ? (
                  <>
                    <ul
                      style={{
                        listStyle: 'none',
                        margin: 0,
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        opacity: historyLoading ? 0.6 : 1,
                        transition: 'opacity 0.15s ease',
                      }}
                    >
                      {payments.map((payment) => {
                        const isPaid = payment.status === 'paid'
                        const isFailed = payment.status === 'failed' || payment.status === 'cancelled'
                        const payerName = payment.member_name || payment.created_by_name
                        return (
                          <li
                            key={payment.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                              padding: '8px 10px',
                              borderRadius: 8,
                              background: 'var(--bg-card, rgba(255, 255, 255, 0.75))',
                              border: '1px solid var(--line)',
                            }}
                          >
                            {/* Primary row: Amount + Plan Badge on Left, Status Badge on Right */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                                <b style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                                  {inr(Number(payment.total_amount || payment.base_amount || 0))}
                                </b>
                                {payment.plan_name && (
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                      background: 'var(--bg-subtle, rgba(0,0,0,0.04))',
                                      color: 'var(--ink-soft)',
                                      fontWeight: 500,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {payment.plan_name}
                                    {payment.plan_billing_cycle ? ` • ${payment.plan_billing_cycle.replace(/_/g, ' ')}` : ''}
                                  </span>
                                )}
                                {payment.scope_type && (
                                  <span
                                    style={{
                                      fontSize: '0.66rem',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.03em',
                                      padding: '1px 5px',
                                      borderRadius: 4,
                                      background: payment.scope_type === 'chapter' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(168, 85, 247, 0.08)',
                                      color: payment.scope_type === 'chapter' ? '#2563eb' : '#7c3aed',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {payment.scope_type}
                                  </span>
                                )}
                              </div>

                              <span
                                style={{
                                  padding: '2px 7px',
                                  borderRadius: 10,
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  background: isPaid
                                    ? 'rgba(34, 197, 94, 0.12)'
                                    : payment.status === 'refunded'
                                    ? 'rgba(147, 51, 234, 0.12)'
                                    : isFailed
                                    ? 'rgba(239, 68, 68, 0.12)'
                                    : 'rgba(245, 158, 11, 0.12)',
                                  color: isPaid
                                    ? '#15803d'
                                    : payment.status === 'refunded'
                                    ? '#7e22ce'
                                    : isFailed
                                    ? '#b91c1c'
                                    : '#b45309',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                }}
                              >
                                {statusLabel(payment.status)}
                              </span>
                            </div>

                            {/* Secondary row: Member / Chapter / Txn ID on Left, Date & Time on Right */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap', fontSize: '0.74rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0, color: 'var(--ink-mute)' }}>
                                {isRegionAdmin && payerName && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--ink)', fontWeight: 500 }}>
                                    <User size={11} style={{ color: 'var(--ink-mute)' }} />
                                    <span>{payerName}</span>
                                    {payment.created_by_mobile && (
                                      <span style={{ color: 'var(--ink-mute)', fontSize: '0.7rem' }}>({payment.created_by_mobile})</span>
                                    )}
                                  </span>
                                )}

                                {payment.chapter_name && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--brand)', fontWeight: 600 }}>
                                    <Building2 size={11} />
                                    <span>{payment.chapter_name}</span>
                                  </span>
                                )}

                                <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--ink-mute)' }}>
                                  #{payment.merchant_txn_id || payment.gateway_payment_id || 'Txn'}
                                </span>
                              </div>

                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--ink-mute)', fontSize: '0.72rem', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                                <Calendar size={11} />
                                <span>{fmtDateTime(paymentWhen(payment))}</span>
                              </div>
                            </div>

                            {/* Failure reason if any */}
                            {payment.failure_reason && (
                              <div style={{ fontSize: '0.7rem', color: '#b91c1c', marginTop: 1 }}>
                                Reason: {payment.failure_reason}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>

                    {/* Pagination Controls */}
                    {totalCount > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 8,
                          marginTop: 10,
                          paddingTop: 8,
                          borderTop: '1px solid var(--line)',
                        }}
                      >
                        <div style={{ fontSize: '0.76rem', color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>
                            <b>{(page - 1) * pageSize + 1}</b>–<b>{Math.min(page * pageSize, totalCount)}</b> of <b>{totalCount}</b>
                          </span>
                          <select
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value))
                              setPage(1)
                            }}
                            style={{
                              padding: '2px 5px',
                              borderRadius: 4,
                              border: '1px solid var(--line)',
                              background: 'var(--bg-card, #fff)',
                              color: 'var(--ink)',
                              fontSize: '0.74rem',
                              cursor: 'pointer',
                              height: 24,
                            }}
                          >
                            <option value={5}>5 / page</option>
                            <option value={10}>10 / page</option>
                            <option value={20}>20 / page</option>
                            <option value={50}>50 / page</option>
                          </select>
                        </div>

                        {Math.ceil(totalCount / pageSize) > 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              disabled={page <= 1 || historyLoading}
                              onClick={() => setPage((p) => Math.max(1, p - 1))}
                              style={{
                                padding: '2px 6px',
                                height: 26,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2,
                                opacity: page <= 1 ? 0.4 : 1,
                                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                                fontSize: '0.75rem',
                              }}
                            >
                              <ChevronLeft size={13} /> Prev
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              {Array.from({ length: Math.ceil(totalCount / pageSize) }, (_, i) => i + 1)
                                .filter((num, _, arr) => {
                                  const totalP = arr.length
                                  return num === 1 || num === totalP || Math.abs(num - page) <= 1
                                })
                                .map((num, idx, arr) => {
                                  const prev = arr[idx - 1]
                                  const showEllipsis = prev && num - prev > 1
                                  const isCurrent = num === page
                                  return (
                                    <span key={num} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                      {showEllipsis && <span style={{ padding: '0 2px', color: 'var(--ink-mute)', fontSize: '0.72rem' }}>…</span>}
                                      <button
                                        type="button"
                                        onClick={() => setPage(num)}
                                        disabled={historyLoading}
                                        style={{
                                          minWidth: 24,
                                          height: 24,
                                          padding: '0 4px',
                                          borderRadius: 4,
                                          border: isCurrent ? '1px solid var(--brand, #0D6E61)' : '1px solid var(--line)',
                                          background: isCurrent ? 'var(--brand, #0D6E61)' : 'transparent',
                                          color: isCurrent ? '#fff' : 'var(--ink)',
                                          fontWeight: isCurrent ? 700 : 500,
                                          fontSize: '0.75rem',
                                          cursor: isCurrent ? 'default' : 'pointer',
                                          transition: 'all 0.15s ease',
                                        }}
                                      >
                                        {num}
                                      </button>
                                    </span>
                                  )
                                })}
                            </div>

                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              disabled={page >= Math.ceil(totalCount / pageSize) || historyLoading}
                              onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                              style={{
                                padding: '2px 6px',
                                height: 26,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2,
                                opacity: page >= Math.ceil(totalCount / pageSize) ? 0.4 : 1,
                                cursor: page >= Math.ceil(totalCount / pageSize) ? 'not-allowed' : 'pointer',
                                fontSize: '0.75rem',
                              }}
                            >
                              Next <ChevronRight size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty">
                    {chapterFilter !== 'all' || statusFilter !== 'all' || searchQuery
                      ? 'No subscription payments match the selected filters.'
                      : 'No subscription payments have been recorded yet.'}
                  </div>
                )}
              </section>
              )}

              {!status.allowed && canPay && (
                <p className="sub__note">
                  Once payment is completed, your subscription is activated immediately. The billing period starts
                  on the day of payment verification.
                </p>
              )}


              <section className="sub__card sub__payments">
                <h2>Need help?</h2>
                <p className="sub__help">The support team can help with access or payment questions.</p>
                <div className="btn-row">
                  <a className="btn btn--line" href={`tel:${SUPPORT_PHONES[0].replace(/\s/g, '')}`}>
                    <Phone size={16} /> {SUPPORT_PHONES[0]}
                  </a>
                  <a className="btn btn--line" href={`mailto:${SUPPORT_EMAIL}`}>
                    <Mail size={16} /> {SUPPORT_EMAIL}
                  </a>
                </div>
              </section>

              {!isRestricted && (
                <div className="btn-row sub__actions">
                  <button className="btn btn--line" type="button" onClick={() => setReloadKey((n) => n + 1)}>
                    <RefreshCw size={16} /> Check again
                  </button>
                  <button className="btn btn--ghost" type="button" onClick={leave}>
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </>
          ) : null}
        </article>
      </div>
    </>
  )
}
