import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, Gem, Layers, Lock, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Field, Glyph, PageHead, Sheet } from '../../components/ui'
import { inr } from '../../lib/format'
import { BILLING_CYCLE_LABELS, BILLING_CYCLE_RATE_LABEL, BILLING_CYCLE_SUFFIX, totalForCycle } from '../../lib/pricing'
import { apiRequest } from '../../lib/api'
import { createPlan, deletePlan, updatePlan, useDB } from '../../lib/store'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import RegionMultiSelect from '../../components/RegionMultiSelect'
import SearchSelect from '../../components/SearchSelect'
import { matches } from '../../lib/search'
import { fetchSubscriptions, subscriptionList } from '../../lib/subscription'
import type { BillingCycle, Plan, PlanScope, SubscriptionRecord, Tone } from '../../lib/types'

const LOOKS = [
  { icon: Sparkles, tone: 'steel' as Tone },
  { icon: Layers, tone: 'gold' as Tone },
  { icon: Gem, tone: 'red' as Tone },
]

const SCOPES: { value: PlanScope; label: string }[] = [
  { value: 'region', label: 'Region' },
  { value: 'chapter', label: 'Chapter' },
  { value: 'member', label: 'Member' },
]

const CYCLE_ORDER: BillingCycle[] = ['one_time', 'monthly', 'quarterly', 'half_yearly', 'yearly']

interface ScopeMember {
  id: string
  name: string
  isActive?: boolean
  loginEnabled?: boolean
}

interface TeamMember {
  id: string
  name: string
  is_active?: boolean
  login_enabled?: boolean
}

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function Plans() {
  const db = useDB()
  const [q, setQ] = useState('')
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scopeType, setScopeType] = useState<PlanScope>('region')
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [rate, setRate] = useState('')
  const [tax, setTax] = useState('')
  const [regionId, setRegionId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [scopeMembers, setScopeMembers] = useState<ScopeMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [assignAllRegions, setAssignAllRegions] = useState(true)
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const membersRequest = useRef(0)
  const createAttempt = useRef({ fingerprint: '', key: '' })

  useEffect(() => {
    let active = true
    setSubscriptionsLoading(true)
    fetchSubscriptions()
      .then((res) => {
        if (!active) return
        if (res.data) setSubscriptions(subscriptionList(res.data))
        setSubscriptionsLoading(false)
      })
      .catch(() => {
        if (active) setSubscriptionsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const regionChapters = db.chapters.filter((c) => c.regionId === regionId)
  const currentMember = db.members.find((m) => m.id === memberId)
  const editingPlan = editing ? db.plans.find((p) => p.id === editing) : null
  const editingPlanRegionIds = new Set(
    editingPlan?.applicableRegions || (editingPlan?.regionId ? [editingPlan.regionId] : [])
  )
  const openRegionIds = new Set(
    subscriptions
      .filter((sub) => (sub.status === 'pending' || sub.status === 'active') && sub.region)
      .map((sub) => sub.region as string),
  )
  const assignableRegions = db.regions.filter(
    (region) =>
      region.isActive !== false &&
      (!openRegionIds.has(region.id) || editingPlanRegionIds.has(region.id))
  )

  const eligibleMembers = scopeMembers.filter((m) => m.isActive !== false && m.loginEnabled !== false)
  if (currentMember && !eligibleMembers.some((m) => m.id === currentMember.id)) {
    eligibleMembers.push({
      id: currentMember.id,
      name: currentMember.name,
      isActive: currentMember.isActive,
      loginEnabled: currentMember.loginEnabled,
    })
  }
  if (memberId && !eligibleMembers.some((m) => m.id === memberId)) {
    eligibleMembers.push({ id: memberId, name: 'Selected member', isActive: false, loginEnabled: false })
  }

  const memberName = (id?: string) => db.members.find((m) => m.id === id)?.name
  const cycleOf = (p: Plan) => p.billingCycle || 'monthly'
  const scopeOf = (p: Plan) => p.scopeType || (p.chapterId ? 'chapter' : 'region')

  const scopeWords = (p: Plan) => [
    p.applicableRegionNames?.join(', ') || db.regions.find((x) => x.id === p.regionId)?.name,
    db.chapters.find((x) => x.id === p.chapterId)?.name,
    memberName(p.memberId),
    scopeOf(p),
    BILLING_CYCLE_LABELS[cycleOf(p)],
  ]
  const shownPlans = db.plans.filter((p) => matches(q, p.name, p.description, p.rate, ...scopeWords(p)))

  const scopeLabel = (p: Plan) => {
    const r = db.regions.find((x) => x.id === p.regionId)
    const c = db.chapters.find((x) => x.id === p.chapterId)
    const scope = scopeOf(p)
    if (scope === 'region') {
      if (p.applicableRegions && p.applicableRegions.length > 0) {
        if (p.applicableRegions.length === db.regions.length) return 'All regions'
        return p.applicableRegionNames?.join(', ') || p.applicableRegions.map((id) => db.regions.find((x) => x.id === id)?.name).filter(Boolean).join(', ')
      }
      return r ? r.name : 'All regions'
    }
    if (scope === 'chapter') return `${r ? r.name : 'All regions'} ┬╖ ${c ? c.name : 'All chapters'}`
    return `${r ? r.name : 'All regions'} ┬╖ ${c ? c.name : 'All chapters'} ┬╖ ${memberName(p.memberId) || (p.memberId ? 'Member' : 'All members')}`
  }

  const preview: Plan | null =
    Number(rate) > 0
      ? {
          id: '',
          name,
          description,
          scopeType,
          billingCycle,
          rate: Number(rate),
          taxPercent: Number(tax) || 0,
          regionId,
          chapterId,
          memberId,
        }
      : null
  const previewTotal = preview ? totalForCycle(preview) : null

  async function loadMembers(chapter: string) {
    const request = ++membersRequest.current
    if (!chapter) {
      setScopeMembers([])
      setMembersError('')
      setMembersLoading(false)
      return
    }

    setMembersLoading(true)
    setMembersError('')
    const res = await apiRequest<TeamMember[]>(`/members/team/?chapter=${encodeURIComponent(chapter)}`)
    if (request !== membersRequest.current) return

    if (res.error) {
      setScopeMembers([])
      setMembersError(res.error)
    } else {
      setScopeMembers(
        (Array.isArray(res.data) ? res.data : []).map((m) => ({
          id: m.id,
          name: m.name,
          isActive: m.is_active !== false,
          loginEnabled: m.login_enabled !== false,
        })),
      )
    }
    setMembersLoading(false)
  }

  function reset() {
    setEditing(null)
    setName('')
    setDescription('')
    setScopeType('region')
    setBillingCycle('monthly')
    setRate('')
    setTax('')
    setRegionId('')
    setChapterId('')
    setMemberId('')
    setAssignAllRegions(true)
    setSelectedRegionIds([])
    setErrors({})
    createAttempt.current = { fingerprint: '', key: '' }
    void loadMembers('')
  }

  function edit(p: Plan) {
    setEditing(p.id)
    setName(p.name)
    setDescription(p.description)
    const scope = scopeOf(p)
    setScopeType(scope)
    setBillingCycle(cycleOf(p))
    setRate(String(p.rate))
    setTax(String(p.taxPercent))
    setRegionId(p.regionId || '')
    setChapterId(p.chapterId || '')
    setMemberId(p.memberId || '')

    if (scope === 'region') {
      const assignedIds = (p.applicableRegions && p.applicableRegions.length > 0)
        ? p.applicableRegions
        : (p.regionId ? [p.regionId] : [])
      const isAll = assignedIds.length === 0 || assignedIds.length >= db.regions.length
      setAssignAllRegions(isAll)
      setSelectedRegionIds(assignedIds)
    } else {
      setAssignAllRegions(true)
      setSelectedRegionIds([])
    }

    setErrors({})
    void loadMembers(scope === 'member' ? p.chapterId || '' : '')
  }

  function changeScope(next: PlanScope) {
    setScopeType(next)
    if (next === 'region') {
      setRegionId('')
      setChapterId('')
      setMemberId('')
    } else if (next === 'chapter') {
      setMemberId('')
    }
    void loadMembers(next === 'member' ? chapterId : '')
  }

  function changeRegion(next: string) {
    setRegionId(next)
    setChapterId('')
    setMemberId('')
    void loadMembers('')
  }

  function changeChapter(next: string) {
    setChapterId(next)
    setMemberId('')
    void loadMembers(scopeType === 'member' ? next : '')
  }

  async function remove(p: Plan) {
    if (!(await confirm({ title: 'Delete plan?', message: `"${p.name}" will be removed. This cannot be undone.` }))) return
    const res = await deletePlan(p.id)
    if (res.error) return toast(res.error, 'info')
    toast(`Plan "${p.name}" deleted`)
    if (editing === p.id) reset()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Enter the plan name.'
    if (!(Number(rate) > 0)) next.rate = 'Enter a rate greater than 0.'
    if (tax === '' || Number(tax) < 0 || Number(tax) > 100) next.tax = 'Enter a tax between 0 and 100.'
    if (scopeType !== 'region' && chapterId && !regionId) next.chapter = 'Select the region of this chapter.'
    if (scopeType === 'member' && memberId && !chapterId) next.member = 'Select the chapter of this member.'
    const selectedRegionIdsForSubmit = selectedRegionIds.filter((id) => assignableRegions.some((region) => region.id === id))
    if (scopeType === 'region') {
      if (assignAllRegions && assignableRegions.length === 0) next.assignRegions = 'There are no eligible regions to assign right now.'
      if (!assignAllRegions && selectedRegionIdsForSubmit.length === 0) next.assignRegions = 'Select at least one region.'
    }
    setErrors(next)
    if (Object.keys(next).length) return

    const input = {
      name,
      description,
      scopeType,
      billingCycle,
      rate: Number(rate),
      taxPercent: Number(tax),
      regionId,
      chapterId: scopeType === 'region' ? '' : chapterId,
      memberId: scopeType === 'member' ? memberId : '',
    }
    const assignment = scopeType === 'region' ? { assignAllRegions, assignRegionIds: selectedRegionIdsForSubmit } : {}
    if (!editing) {
      const fingerprint = JSON.stringify({ ...input, ...assignment })
      if (createAttempt.current.fingerprint !== fingerprint) {
        createAttempt.current = { fingerprint, key: newIdempotencyKey() }
      }
    }
    setSaving(true)
    try {
      const res = editing
        ? await updatePlan(editing, input, assignment)
        : await createPlan({
            ...input,
            ...assignment,
            idempotencyKey: createAttempt.current.key,
          })
      if (res.error) return setErrors({ [res.field ?? 'form']: res.error })

      if (editing) {
        toast(`Plan "${name.trim()}" updated successfully`)
      } else {
        toast(`Plan "${name.trim()}" created successfully. It is now available for subscription purchase.`)
      }
      reset()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <PageHead
        eyebrow="Super Admin"
        icon={Layers}
        tone="gold"
        title="Plans"
        subtitle="Configure reusable plans and targeting rules. Subscriptions are activated upon verified payment."
        actions={
          <Link to="/admin/subscriptions" className="btn btn--line btn--sm">
            <CreditCard size={15} /> Billing history
          </Link>
        }
      />

      <div className="duo">
        <Sheet icon={editing ? Pencil : Plus} tone="gold" title={editing ? 'Update plan' : 'Create plan'} note="Scope, cycle and tax">
          <form className="form-stack" onSubmit={submit} noValidate>
            <Field label="Plan name" required error={errors.name}>
              <input className="field__control" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Description">
              <textarea className="field__control" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this plan includes" />
            </Field>

            <Field label="Payment For" required error={errors.scopeType}>
              <select className="field__control native-select" value={scopeType} onChange={(e) => changeScope(e.target.value as PlanScope)}>
                {SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            {scopeType === 'region' ? (
              <div className="form-stack">
                <Field label="Assign to regions" required error={errors.assignRegions}>
                  <select
                    className="field__control native-select"
                    value={assignAllRegions ? 'all' : 'selected'}
                    onChange={(e) => {
                      const isAll = e.target.value === 'all'
                      setAssignAllRegions(isAll)
                      if (errors.assignRegions) {
                        setErrors((prev) => {
                          const next = { ...prev }
                          delete next.assignRegions
                          return next
                        })
                      }
                    }}
                  >
                    <option value="all">All eligible regions ({assignableRegions.length})</option>
                    <option value="selected">Selected regions</option>
                  </select>
                </Field>
                {!assignAllRegions && (
                  <RegionMultiSelect
                    regions={assignableRegions}
                    selectedIds={selectedRegionIds}
                    onChange={(ids) => {
                      setSelectedRegionIds(ids)
                      if (errors.assignRegions && ids.length > 0) {
                        setErrors((prev) => {
                          const next = { ...prev }
                          delete next.assignRegions
                          return next
                        })
                      }
                    }}
                    loading={subscriptionsLoading}
                    error={errors.assignRegions}
                  />
                )}
                <p className="field__hint">
                  {editing
                    ? 'Changes to assigned regions will update region targeting and create pending subscriptions for newly added regions.'
                    : 'A pending subscription is created for each selected region. Access starts only after payment verification.'}
                </p>
              </div>
            ) : (
              <div className="form-grid form-grid--2">
                <Field label="Region">
                  <SearchSelect
                    value={regionId}
                    onChange={changeRegion}
                    placeholder="All regions"
                    searchPlaceholder="Search regions…"
                    options={db.regions.map((r) => ({
                      id: r.id,
                      name: r.name,
                      sub: r.code,
                    }))}
                  />
                </Field>

                <Field label="Chapter" error={errors.chapter}>
                  <SearchSelect
                    value={chapterId}
                    onChange={(id) => {
                      changeChapter(id)
                      if (errors.chapter) {
                        setErrors((prev) => {
                          const next = { ...prev }
                          delete next.chapter
                          return next
                        })
                      }
                    }}
                    disabled={!regionId}
                    error={Boolean(errors.chapter)}
                    placeholder={regionId ? 'All chapters' : 'All chapters (all regions)'}
                    searchPlaceholder="Search chapters…"
                    options={regionChapters.map((c) => ({
                      id: c.id,
                      name: c.name,
                      sub: c.code || c.city,
                    }))}
                  />
                </Field>
                {!editing && (
                  <p className="field__hint" style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                    A pending subscription is created for {chapterId ? 'the selected chapter' : 'all chapters'}. Chapter members on the Head Table will be redirected to the subscription page until verified.
                  </p>
                )}
              </div>
            )}

            {scopeType === 'member' && (
              <>
                <Field label="Member" error={errors.member || membersError}>
                  <SearchSelect
                    value={memberId}
                    onChange={(id) => {
                      setMemberId(id)
                      if (errors.member) {
                        setErrors((prev) => {
                          const next = { ...prev }
                          delete next.member
                          return next
                        })
                      }
                    }}
                    disabled={!chapterId || membersLoading}
                    loading={membersLoading}
                    error={Boolean(errors.member || membersError)}
                    placeholder={
                      chapterId
                        ? membersLoading
                          ? 'Loading members…'
                          : 'All members'
                        : 'All members (all chapters)'
                    }
                    searchPlaceholder="Search members…"
                    options={eligibleMembers.map((m) => ({
                      id: m.id,
                      name: m.name,
                    }))}
                  />
                </Field>
                {!editing && (
                  <p className="field__hint" style={{ marginTop: -8 }}>
                    Configures availability for {memberId ? 'the selected member' : 'all members in the chapter'}. They will be prompted to subscribe upon login.
                  </p>
                )}
              </>
            )}

            <Field label="Rate Type" required>
              <select className="field__control native-select" value={billingCycle} onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}>
                {CYCLE_ORDER.map((cycle) => (
                  <option key={cycle} value={cycle}>
                    {BILLING_CYCLE_LABELS[cycle]}
                  </option>
                ))}
              </select>
            </Field>

            <div className="form-grid form-grid--2">
              <Field label={BILLING_CYCLE_RATE_LABEL[billingCycle]} required error={errors.rate}>
                <input className="field__control" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} />
              </Field>
              <Field label="Tax (%)" required error={errors.tax}>
                <input
                  className="field__control"
                  inputMode="decimal"
                  placeholder="18"
                  value={tax}
                  onChange={(e) => setTax(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </Field>
            </div>

            {preview && previewTotal && (
              <div className="preview">
                <div>
                  <span>{BILLING_CYCLE_LABELS[billingCycle]} total</span>
                  <b>{inr(previewTotal.total)}</b>
                </div>
                <div>
                  <span>Base + tax</span>
                  <b>
                    {inr(previewTotal.base)} + {inr(previewTotal.tax)}
                  </b>
                </div>
              </div>
            )}

            {errors.form && <div className="form-error">{errors.form}</div>}
            <div className="btn-row">
              <button className="btn btn--primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Update' : scopeType === 'region' ? 'Create and assign' : 'Save'}
              </button>
              {editing && (
                <button className="btn btn--ghost" type="button" onClick={reset} disabled={saving}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Sheet>

        <div className="list">
          <h2 className="list__title">
            All plans <span>{db.plans.length}</span>
          </h2>
          <ListSearch value={q} onChange={setQ} placeholder="Search plans" />
          {q && shownPlans.length === 0 && db.plans.length > 0 && <NoMatch query={q} />}
          <div className="plans">
            {shownPlans.map((p) => {
              const look = LOOKS[db.plans.indexOf(p) % LOOKS.length]
              const cycle = cycleOf(p)
              return (
                <article key={p.id} className={`plan ${editing === p.id ? 'is-on' : ''}`}>
                  <div className="plan__top">
                    <Glyph icon={look.icon} tone={look.tone} size={44} />
                    <h2>{p.name}</h2>
                  </div>
                  <div className="plan__price">
                    {inr(p.rate)}
                    <small>{BILLING_CYCLE_SUFFIX[cycle]}</small>
                  </div>
                  <div className="plan__tax">+ {p.taxPercent}% tax</div>
                  <div className="chips">
                    <span className="chip chip--gold">{scopeLabel(p)}</span>
                    <span className="chip">{BILLING_CYCLE_LABELS[cycle]}</span>
                  </div>
                  <p className="plan__desc">{p.description || 'No description.'}</p>
                  <div className="plan__totals">
                    <div>
                      <span>Base</span>
                      <b>{inr(p.rate)}</b>
                    </div>
                    <div>
                      <span>{BILLING_CYCLE_LABELS[cycle]} total</span>
                      <b>{inr(totalForCycle(p).total)}</b>
                    </div>
                  </div>
                  <div className="btn-row">
                    <button className="btn btn--line btn--sm" style={{ flex: 1 }} onClick={() => edit(p)}>
                      <Pencil size={14} /> Edit
                    </button>
                    {(() => {
                      const locked = p.canDelete === false || subscriptions.some((sub) => sub.plan === p.id && (sub.status === 'active' || sub.status === 'past_due'))
                      return locked ? (
                        <button type="button" className="btn btn--line btn--sm" disabled title="Locked: An active subscription or verified payment uses this plan." style={{ color: 'var(--ink-mute)', opacity: 0.45, cursor: 'not-allowed' }}>
                          <Lock size={14} /> Delete
                        </button>
                      ) : (
                        <button type="button" className="btn btn--line btn--sm" title="Delete plan" onClick={() => remove(p)} style={{ color: '#ef4444' }}>
                          <Trash2 size={14} /> Delete
                        </button>
                      )
                    })()}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
