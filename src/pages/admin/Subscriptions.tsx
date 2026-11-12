import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  Clock,
  CreditCard,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { Glyph, PageHead, StatStrip } from '../../components/ui'
import { fmtDate, inr } from '../../lib/format'
import { BILLING_CYCLE_LABELS } from '../../lib/pricing'
import { activateSubscription, fetchSubscriptions, subscriptionList } from '../../lib/subscription'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import type { BillingCycle, PlanScope, SubscriptionRecord } from '../../lib/types'

const SCOPE_TABS: { key: 'all' | PlanScope; label: string }[] = [
  { key: 'all', label: 'All Scopes' },
  { key: 'region', label: 'Regions' },
  { key: 'chapter', label: 'Chapters' },
  { key: 'member', label: 'Members' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PAYMENT_STATUS_OPTIONS = [
  { value: 'all', label: 'All Payment States' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending Payment' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const CYCLE_OPTIONS: { value: 'all' | BillingCycle; label: string }[] = [
  { value: 'all', label: 'All Billing Cycles' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-Yearly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one_time', label: 'One-Time' },
]

function statusTone(status: string) {
  if (status === 'active') return 'ok'
  if (status === 'pending') return 'warn'
  if (status === 'expired' || status === 'cancelled' || status === 'failed') return 'bad'
  return 'idle'
}

function statusText(status: string) {
  return status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function targetLabel(sub: SubscriptionRecord) {
  if (sub.scope_type === 'member') {
    return sub.member_name
      ? `${sub.member_name} (${sub.chapter_name || ''})`
      : 'Member'
  }
  if (sub.scope_type === 'chapter') {
    return sub.chapter_name ? `${sub.chapter_name}` : 'Chapter'
  }
  return sub.region_name || 'Region'
}

function getPeriodRemaining(endDateStr: string | null, status: string) {
  if (!endDateStr) {
    return {
      label: status === 'pending' ? 'Pending Verification' : 'No Expiry',
      tone: 'idle' as const,
    }
  }

  const end = new Date(endDateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const diffTime = end.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { label: `Expired ${Math.abs(diffDays)}d ago`, tone: 'bad' as const }
  }
  if (diffDays === 0) {
    return { label: 'Expires today', tone: 'urgent' as const }
  }
  if (diffDays === 1) {
    return { label: 'Expires tomorrow (1 day)', tone: 'urgent' as const }
  }
  if (diffDays <= 7) {
    return { label: `${diffDays} days remaining`, tone: 'urgent' as const }
  }
  return { label: `${diffDays} days remaining`, tone: 'active' as const }
}

export default function Subscriptions() {
  const toast = useToast()
  const confirm = useConfirm()
  const [items, setItems] = useState<SubscriptionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activating, setActivating] = useState<string | null>(null)

  // Multi-dimensional filters
  const [searchQuery, setSearchQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState<'all' | PlanScope>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [cycleFilter, setCycleFilter] = useState<'all' | BillingCycle>('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const res = await fetchSubscriptions()
    if (res.error) {
      setLoadError(res.error)
    } else {
      setItems(subscriptionList(res.data))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    fetchSubscriptions().then((res) => {
      if (!active) return
      if (res.error) setLoadError(res.error)
      else setItems(subscriptionList(res.data))
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  // Count metrics
  const activeCount = useMemo(
    () => items.filter((s) => s.status === 'active').length,
    [items]
  )
  const pendingCount = useMemo(
    () => items.filter((s) => s.status === 'pending').length,
    [items]
  )
  const totalRevenue = useMemo(
    () =>
      items
        .filter((s) => s.status === 'active' || s.latest_payment_status === 'paid')
        .reduce((sum, s) => sum + Number(s.total_amount || 0), 0),
    [items]
  )

  // Scope counters for tabs
  const scopeCounts = useMemo(() => {
    return {
      all: items.length,
      region: items.filter((s) => s.scope_type === 'region').length,
      chapter: items.filter((s) => s.scope_type === 'chapter').length,
      member: items.filter((s) => s.scope_type === 'member').length,
    }
  }, [items])

  // Filter evaluation
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return items.filter((sub) => {
      // Scope match
      if (scopeFilter !== 'all' && sub.scope_type !== scopeFilter) return false

      // Status match
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false

      // Billing cycle match
      if (cycleFilter !== 'all' && sub.plan_billing_cycle !== cycleFilter) return false

      // Payment status match
      if (paymentStatusFilter !== 'all') {
        const pStatus = (sub.latest_payment_status || '').toLowerCase()
        if (pStatus !== paymentStatusFilter) return false
      }

      // Search match
      if (q) {
        const textToMatch = [
          targetLabel(sub),
          sub.plan_name,
          sub.region_name,
          sub.chapter_name,
          sub.member_name,
          sub.purchased_by_name,
          sub.scope_type,
          sub.status,
          sub.latest_payment_status,
          sub.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!textToMatch.includes(q)) return false
      }

      return true
    })
  }, [items, searchQuery, scopeFilter, statusFilter, cycleFilter, paymentStatusFilter])

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    scopeFilter !== 'all' ||
    statusFilter !== 'all' ||
    cycleFilter !== 'all' ||
    paymentStatusFilter !== 'all'

  function resetFilters() {
    setSearchQuery('')
    setScopeFilter('all')
    setStatusFilter('all')
    setCycleFilter('all')
    setPaymentStatusFilter('all')
  }

  async function activate(sub: SubscriptionRecord) {
    const label = targetLabel(sub)
    const ok = await confirm({
      title: 'Verify payment?',
      message: `Activate ${label} on ${sub.plan_name}? The term starts today.`,
    })
    if (!ok) return

    setActivating(sub.id)
    const res = await activateSubscription(sub.id)
    setActivating(null)
    if (res.error) return toast(res.error, 'info')
    toast(`${label} subscription activated`)
    await load()
  }

  return (
    <div className="page">
      <PageHead
        eyebrow="Super Admin"
        icon={CreditCard}
        tone="gold"
        title="Billing history"
        subtitle="Monitor active subscriptions, renewal dates, and payment history across regions, chapters, and members."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn btn--line btn--sm"
              type="button"
              title="Refresh subscriptions"
              onClick={() => void load()}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
            </button>
            <Link to="/admin/plans" className="btn btn--primary btn--sm">
              <Plus size={15} /> Create plan
            </Link>
          </div>
        }
      />

      {/* KPI Metric Strip */}
      <StatStrip
        items={[
          {
            icon: CreditCard,
            tone: 'navy',
            label: 'Total Subscriptions',
            value: items.length,
          },
          {
            icon: BadgeCheck,
            tone: 'green',
            label: 'Active Subscriptions',
            value: activeCount,
          },
          {
            icon: Clock,
            tone: 'gold',
            label: 'Pending Verification',
            value: pendingCount,
          },
          {
            icon: Sparkles,
            tone: 'wine',
            label: 'Total Collected',
            value: inr(totalRevenue),
          },
        ]}
      />

      <div style={{ height: 20 }} />

      {/* Multi-Dimensional Filter Panel */}
      <div className="sub-filter-panel">
        <div className="sub-filter-grid">
          {/* Search Bar */}
          <div className="sub-search-wrap">
            <Search size={16} className="sub-search-icon" />
            <input
              type="text"
              className="sub-search-input"
              placeholder="Search target, plan, region or member…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="sub-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Status Select */}
          <select
            className="sub-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by subscription status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Billing Cycle Select */}
          <select
            className="sub-select"
            value={cycleFilter}
            onChange={(e) => setCycleFilter(e.target.value as 'all' | BillingCycle)}
            aria-label="Filter by billing cycle"
          >
            {CYCLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Payment Status Select */}
          <select
            className="sub-select"
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            aria-label="Filter by payment status"
          >
            {PAYMENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Scope Tabs & Clear Action Footer */}
        <div className="sub-filter-footer">
          <div className="filter-tabs" style={{ margin: 0 }}>
            {SCOPE_TABS.map((tab) => {
              const count = scopeCounts[tab.key]
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`filter-tab ${scopeFilter === tab.key ? 'filter-tab--active' : ''}`}
                  onClick={() => setScopeFilter(tab.key)}
                >
                  {tab.label} <span style={{ opacity: 0.75, fontSize: 12 }}>({count})</span>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--ink-mute)', fontWeight: 500 }}>
              Showing <b>{filtered.length}</b> of {items.length}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn--line btn--sm"
                onClick={resetFilters}
                style={{ height: 32, fontSize: 12.5 }}
              >
                <X size={13} /> Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Cards List */}
      <div className="sub-card-list">
        {loading ? (
          <div className="empty">
            <RefreshCw size={24} className="spin" style={{ color: 'var(--brand)', marginBottom: 8 }} />
            <b>Loading billing history…</b>
            <span>Reading verified subscriptions and records from the server.</span>
          </div>
        ) : loadError ? (
          <div className="form-error">
            {loadError}
            <button className="link-btn" type="button" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <Filter size={24} style={{ color: 'var(--ink-mute)', marginBottom: 8 }} />
            <b>No subscriptions found</b>
            <span>
              {hasActiveFilters
                ? 'No subscriptions match your active filter criteria.'
                : 'No subscription records exist in the database yet.'}
            </span>
            {hasActiveFilters ? (
              <button
                type="button"
                className="btn btn--line btn--sm"
                onClick={resetFilters}
                style={{ marginTop: 12 }}
              >
                Clear all filters
              </button>
            ) : (
              <Link to="/admin/plans" className="btn btn--primary btn--sm" style={{ marginTop: 12 }}>
                Configure plans
              </Link>
            )}
          </div>
        ) : (
          filtered.map((sub) => {
            const period = getPeriodRemaining(sub.current_period_end, sub.status)
            const isActive = sub.status === 'active'

            return (
              <article
                key={sub.id}
                className={`sub-card-item ${isActive ? 'sub-card-item--active' : ''}`}
              >
                {/* Header Row */}
                <div className="sub-card-header">
                  <div className="sub-card-identity">
                    <Glyph
                      icon={CreditCard}
                      tone={isActive ? 'green' : sub.status === 'pending' ? 'gold' : 'wine'}
                      size={48}
                    />
                    <div className="sub-card-titles">
                      <div className="sub-card-target-row">
                        <span className="sub-card-target-name">{targetLabel(sub)}</span>
                        <span className="chip chip--sm chip--gold" style={{ textTransform: 'capitalize' }}>
                          {sub.scope_type}
                        </span>
                        <span className={`stat stat--${statusTone(sub.status)}`}>
                          {statusText(sub.status)}
                        </span>
                        {sub.latest_payment_status && (
                          <span className={`stat stat--${statusTone(sub.latest_payment_status)}`}>
                            {sub.latest_payment_status === 'paid' ? 'Paid' : statusText(sub.latest_payment_status)}
                          </span>
                        )}
                      </div>

                      <div className="sub-card-subtitle">
                        <span>{sub.plan_name}</span>
                        <span>•</span>
                        <span>{BILLING_CYCLE_LABELS[sub.plan_billing_cycle] || sub.plan_billing_cycle}</span>
                        {sub.scope_type !== 'region' && sub.region_name && (
                          <>
                            <span>•</span>
                            <span>Region: <b>{sub.region_name}</b></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pricing & Verified Status */}
                  <div className="sub-card-pricing">
                    <div className="sub-card-amount">
                      {inr(Number(sub.total_amount))}
                      <small>
                        /{sub.plan_billing_cycle === 'one_time' ? 'flat' : sub.plan_billing_cycle.replace(/_/g, ' ')}
                      </small>
                    </div>
                    {isActive && sub.latest_payment_status === 'paid' && (
                      <span className="sub-verified-pill">
                        <BadgeCheck size={14} /> Verified Payment
                      </span>
                    )}
                    {sub.status === 'pending' && (
                      <button
                        className="btn btn--primary btn--sm"
                        type="button"
                        disabled={activating === sub.id}
                        onClick={() => void activate(sub)}
                        style={{ marginTop: 4 }}
                      >
                        <ShieldCheck size={14} /> {activating === sub.id ? 'Verifying…' : 'Verify & Activate'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Highlighted From - To Dates Period Card */}
                <div className="sub-period-card">
                  <div className="sub-period-dates">
                    <div className="sub-date-pill sub-date-pill--from">
                      <span className="sub-date-label">From (Start Date)</span>
                      <span className="sub-date-val">
                        {sub.current_period_start ? fmtDate(sub.current_period_start) : 'Not started'}
                      </span>
                    </div>

                    <div className="sub-date-separator">
                      <ArrowRight size={15} />
                    </div>

                    <div className="sub-date-pill sub-date-pill--to">
                      <span className="sub-date-label">To (Expiry Date)</span>
                      <span className="sub-date-val">
                        {sub.current_period_end ? fmtDate(sub.current_period_end) : 'No expiration'}
                      </span>
                    </div>
                  </div>

                  {/* Period badge: Remaining days or expiration status */}
                  <div
                    className={`sub-period-status-badge sub-period-status-badge--${
                      period.tone === 'active' ? 'active' : period.tone === 'urgent' ? 'urgent' : 'expired'
                    }`}
                  >
                    <Calendar size={14} />
                    <span>{period.label}</span>
                  </div>
                </div>

                {/* Card Footer Breakdown */}
                <div className="sub-card-footer">
                  <div>
                    <span>
                      Base rate: <b>{inr(Number(sub.base_amount || 0))}</b> + GST ({sub.tax_percent}%):{' '}
                      <b>{inr(Number(sub.tax_amount || 0))}</b>
                    </span>
                    {sub.purchased_by_name && (
                      <span style={{ marginLeft: 8 }}>
                        • Payer: <b>{sub.purchased_by_name}</b>
                      </span>
                    )}
                  </div>

                  <div>
                    {sub.latest_payment_verified_at ? (
                      <span>
                        Verified on <b>{fmtDate(sub.latest_payment_verified_at)}</b>
                      </span>
                    ) : (
                      <span>Created {fmtDate(sub.created_at)}</span>
                    )}
                    {sub.latest_payment_txn_id && (
                      <span style={{ marginLeft: 8 }}>
                        · Txn: <b style={{ fontFamily: 'monospace', letterSpacing: '0.02em' }}>{sub.latest_payment_txn_id}</b>
                      </span>
                    )}
                    {sub.latest_payment_gateway_id && (
                      <span style={{ marginLeft: 6, color: 'var(--ink-mute)' }}>
                        (<span style={{ fontFamily: 'monospace' }}>{sub.latest_payment_gateway_id}</span>)
                      </span>
                    )}
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}
