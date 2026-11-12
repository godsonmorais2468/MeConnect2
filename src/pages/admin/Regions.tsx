import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Landmark, Layers, Lock, Map, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react'
import { Field, Glyph, PageHead, Sheet, StatStrip, Toggle } from '../../components/ui'
import { addMonths } from '../../lib/dues'
import { fmtDate } from '../../lib/format'
import { createRegion, updateRegion, deleteRegion, isMobile, isPin, useDB } from '../../lib/store'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import type { Region } from '../../lib/types'

export default function Regions() {
  const db = useDB()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const shownRegions = db.regions.filter((r) => matches(q, r.code, r.name, r.adminName, r.adminMobile, r.email))
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminMobile, setAdminMobile] = useState('')
  const [email, setEmail] = useState('')
  const [showMpin, setShowMpin] = useState(false)
  const [adminPin, setAdminPin] = useState('')
  const [subscriptionStartDate, setSubscriptionStartDate] = useState('')
  const [subscriptionEndDate, setSubscriptionEndDate] = useState('')
  /* The end date follows the start date (6 months later) until someone sets it by hand. */
  const [endEdited, setEndEdited] = useState(false)
  const [maxChapters, setMaxChapters] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [grandfathered, setGrandfathered] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function reset() {
    setEditing(null)
    setCode('')
    setName('')
    setAdminName('')
    setAdminMobile('')
    setEmail('')
    setAdminPin('')
    setShowMpin(false)
    setSubscriptionStartDate('')
    setSubscriptionEndDate('')
    setEndEdited(false)
    setMaxChapters('0')
    setIsActive(true)
    setGrandfathered(false)
    setErrors({})
  }

  function edit(r: Region) {
    setEditing(r.id)
    setCode(r.code || '')
    setName(r.name)
    setAdminName(r.adminName)
    setAdminMobile(r.adminMobile)
    setEmail(r.email || '')
    setAdminPin(r.adminPin || '')
    setSubscriptionStartDate(r.subscriptionStartDate || '')
    setSubscriptionEndDate(r.subscriptionEndDate || '')
    setEndEdited(Boolean(r.subscriptionEndDate))
    setMaxChapters(r.maxChapters != null ? String(r.maxChapters) : '0')
    setIsActive(r.isActive !== undefined ? r.isActive : true)
    setGrandfathered(r.subscriptionGrandfathered === true)
    setErrors({})
  }

  async function remove(r: Region) {
    if (!(await confirm({ title: 'Delete region?', message: `"${r.name}" will be removed. This cannot be undone.` }))) return
    const res = await deleteRegion(r.id)
    if (res.error) {
      toast(res.error, 'info')
      return
    }
    toast(`Region "${r.name}" deleted`)
    if (editing === r.id) reset()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!code.trim()) next.code = 'Enter the region code.'
    else if (!/^[A-Za-z0-9-]{2,20}$/.test(code.trim())) next.code = 'Code can use letters, numbers and hyphens only (2 to 20 characters).'
    if (!name.trim()) next.name = 'Enter the region name.'
    if (!adminName.trim()) next.adminName = 'Enter the ED name.'
    if (!isMobile(adminMobile)) next.adminMobile = 'Enter a 10-digit contact number.'
    if (!email.trim()) next.email = 'Enter the region email.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!editing && !isPin(adminPin)) next.pin = 'MPIN must be a 4-digit number.'
    if (editing && adminPin && !isPin(adminPin)) next.pin = 'MPIN must be a 4-digit number.'
    if (subscriptionStartDate && subscriptionEndDate && subscriptionStartDate > subscriptionEndDate) {
      next.subscriptionEndDate = 'End date cannot be earlier than start date.'
    }
    const maxNum = parseInt(maxChapters, 10)
    if (isNaN(maxNum) || maxNum < 0) {
      next.maxChapters = 'Enter a valid number (0 for unlimited).'
    } else if (editing && maxNum > 0) {
      const existing = db.chapters.filter((c) => c.regionId === editing).length
      if (maxNum < existing) next.maxChapters = `This region already has ${existing} chapters. Set the limit to ${existing} or more (0 means no limit).`
    }

    setErrors(next)
    if (Object.keys(next).length) return

    const parsedMax = isNaN(maxNum) ? 0 : maxNum

    if (editing) {
      const res = await updateRegion(editing, {
        code,
        name,
        adminName,
        adminMobile,
        email,
        ...(adminPin ? { adminPin } : {}),
        subscriptionStartDate,
        subscriptionEndDate,
        subscriptionGrandfathered: grandfathered,
        maxChapters: parsedMax,
        isActive,
      })
      if (res.error) return setErrors({ [res.field ?? 'form']: res.error })
      toast(`Region ${name.trim()} updated`)
      reset()
    } else {
      const res = await createRegion({
        code,
        name,
        adminName,
        adminMobile,
        email,
        adminPin,
        subscriptionStartDate,
        subscriptionEndDate,
        subscriptionGrandfathered: grandfathered,
        maxChapters: parsedMax,
        isActive,
      })
      if (res.error) return setErrors({ [res.field ?? 'form']: res.error })
      toast(`Region ${name.trim()} created`)
      reset()
    }
  }

  return (
    <div className="page">
      <PageHead eyebrow="Super Admin" icon={Map} title="Regions" subtitle="Create regions and the region admin login that manages each one." />

      <StatStrip
        items={[
          { icon: Map, tone: 'red', label: 'Regions', value: db.regions.length },
          { icon: Landmark, tone: 'wine', label: 'Chapters', value: db.chapters.length },
          { icon: Users, tone: 'green', label: 'Members', value: db.members.length },
          { icon: Layers, tone: 'gold', label: 'Plans', value: db.plans.length },
        ]}
      />

      <div className="duo">
        <Sheet icon={UserPlus} title={editing ? "Edit region" : "Create region"} note="With its region admin login">
          <form className="form-stack" onSubmit={submit} noValidate>
            <Field label="Code" required error={errors.code}>
              <input className="field__control" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={20} autoCapitalize="characters" />
            </Field>
            <Field label="Region Name" required error={errors.name}>
              <input className="field__control" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="ED Name" required error={errors.adminName}>
              <input className="field__control" placeholder="Executive Director" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
            </Field>
            <Field label="ED Contact Number" required error={errors.adminMobile}>
              <input
                className="field__control"
                inputMode="numeric"
                placeholder="10-digit contact number"
                value={adminMobile}
                onChange={(e) => setAdminMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </Field>
            <Field label="Email" required error={errors.email}>
              <input className="field__control" type="email" inputMode="email" placeholder="region@ltrt.in" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="MPIN" required={!editing} hint="4-digit number for the first login — the region then sets their own MPIN" error={errors.pin}>
              <div className="mpin">
                <input
                  className="field__control"
                  type={showMpin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="new-password"
                  placeholder={editing ? 'Leave blank to keep the current MPIN' : '4 digits'}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <button type="button" className="mpin__eye" onClick={() => setShowMpin((v) => !v)} aria-label={showMpin ? 'Hide MPIN' : 'Show MPIN'}>
                  {showMpin ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </Field>

            <Field label="Subscription Start Date (Optional / Legacy)" hint="Only set if bypassing the online subscription plan flow with manual dates." error={errors.subscriptionStartDate}>
              <input
                type="date"
                className="field__control"
                value={subscriptionStartDate}
                onChange={(e) => {
                  const start = e.target.value
                  setSubscriptionStartDate(start)
                  if (!endEdited && start) setSubscriptionEndDate(addMonths(start, 6))
                }}
              />
            </Field>

            <Field label="Subscription End Date (Optional / Legacy)" hint="Only set if bypassing the online subscription plan flow." error={errors.subscriptionEndDate}>
              <input
                type="date"
                className="field__control"
                value={subscriptionEndDate}
                onChange={(e) => {
                  setSubscriptionEndDate(e.target.value)
                  setEndEdited(e.target.value !== '')
                }}
              />
            </Field>

            <Field
              label="Number of Chapters"
              hint="Chapters this region can create. 0 means no limit."
              error={errors.maxChapters}
            >
              <input
                type="number"
                min="0"
                className="field__control"
                placeholder="0"
                value={maxChapters}
                onChange={(e) => setMaxChapters(e.target.value)}
              />
            </Field>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px' }}>
              <div>
                <span style={{ fontWeight: 500, fontSize: '14.5px', display: 'block' }}>Exempt from Subscription</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #71717a)' }}>Grant free access without requiring an online subscription plan</span>
              </div>
              <Toggle checked={grandfathered} onChange={setGrandfathered} label="Exempt from Subscription" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px' }}>
              <span style={{ fontWeight: 500, fontSize: '14.5px' }}>Status (Active/Inactive)</span>
              <Toggle checked={isActive} onChange={setIsActive} label="Status Active or Inactive" />
            </div>

            {errors.form && <div className="form-error">{errors.form}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn--primary" type="submit">
                {editing ? <Pencil size={16} /> : <Plus size={16} />} {editing ? 'Update' : 'Save'}
              </button>
              {editing && (
                <button className="btn btn--ghost" type="button" onClick={reset}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Sheet>

        <div className="list">
          <h2 className="list__title">
            All regions <span>{db.regions.length}</span>
          </h2>
          <ListSearch value={q} onChange={setQ} placeholder="Search regions" />
          {q && shownRegions.length === 0 && db.regions.length > 0 && <NoMatch query={q} />}
          {shownRegions.map((r) => {
            const currentCount = db.chapters.filter((c) => c.regionId === r.id).length
            const limitText = r.maxChapters && r.maxChapters > 0 ? `${currentCount} / ${r.maxChapters} chapters` : `${currentCount} chapters`

            return (
              <article
                key={r.id}
                className="row row--click"
                style={{ opacity: r.isActive === false ? 0.7 : 1 }}
                role="link"
                tabIndex={0}
                aria-label={`Chapters of ${r.name}`}
                onClick={() => navigate(`/admin/regions/${r.id}`)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    navigate(`/admin/regions/${r.id}`)
                  }
                }}
              >
                {/* the edit and delete buttons do their own thing, not open the region */}
                <div className="row__acts" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    title="Edit region"
                    onClick={() => edit(r)}
                    style={{ padding: '6px 8px' }}
                  >
                    <Pencil size={15} />
                  </button>
                  {(() => {
                    const chaptersCount = db.chapters.filter((c) => c.regionId === r.id).length
                    const membersCount = db.members.filter((m) => m.regionId === r.id).length
                    const isLocked = chaptersCount > 0 || membersCount > 0

                    if (isLocked) {
                      const reason = chaptersCount > 0 && membersCount > 0
                        ? `Locked: Contains ${chaptersCount} chapter(s) and ${membersCount} member(s). Delete them first to unlock.`
                        : chaptersCount > 0
                        ? `Locked: Contains ${chaptersCount} chapter(s). Delete them first to unlock.`
                        : `Locked: Contains ${membersCount} member(s). Delete them first to unlock.`

                      return (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          disabled
                          title={reason}
                          style={{
                            padding: '6px 8px',
                            color: 'var(--ink-mute)',
                            opacity: 0.45,
                            cursor: 'not-allowed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Lock size={14} />
                        </button>
                      )
                    }

                    return (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        title="Delete region (unlocked: no connected chapters or members)"
                        onClick={() => remove(r)}
                        style={{ padding: '6px 8px', color: '#ef4444' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )
                  })()}
                </div>
                <Glyph icon={Map} tone="red" size={50} />
                <div className="row__main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b>{r.name}</b>
                    {r.isActive === false ? (
                      <span className="stat stat--bad">Inactive</span>
                    ) : (
                      <span className="stat stat--ok">Active</span>
                    )}
                  </div>
                  <span>
                    {r.code && <>{r.code} · </>}{r.adminName} · {r.adminMobile}
                    {r.subscriptionStartDate && r.subscriptionEndDate && (
                      <> · Valid {fmtDate(r.subscriptionStartDate, { month: 'short', day: 'numeric', year: 'numeric' })} to {fmtDate(r.subscriptionEndDate, { month: 'short', day: 'numeric', year: 'numeric' })}</>
                    )}
                  </span>
                </div>
                <div className="chips">
                  <span className={`chip ${r.maxChapters && currentCount >= r.maxChapters ? 'chip--wine' : 'chip--gold'}`}>
                    {limitText}
                  </span>
                  <span className="chip">{db.members.filter((m) => m.regionId === r.id).length} members</span>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
