import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Calendar,
  UserCheck,
  UserPlus,
  AlertCircle,
  CreditCard,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import SearchSelect from '../../components/SearchSelect'
import { BrandMark, Field, Glyph } from '../../components/ui'
import { apiRequest } from '../../lib/api'
import { fmtDate, fmtTime } from '../../lib/format'

interface PublicMember {
  id: string
  name: string
  organisation: string
  category: string
}

interface PublicMeeting {
  id: string
  title: string
  starts_at: string
  duration_min: number
  mode: string
  venue: string
  is_today: boolean
  is_finished: boolean
}

interface PublicChapterInfo {
  chapter: {
    name: string
    city: string
    code: string
  }
  meeting: PublicMeeting | null
  substitute_enabled: boolean
  substitute_disabled_reason: string
  members: PublicMember[]
  substitute_eligible_members: PublicMember[]
  /** The chapter's modes of pay (Accounts > Mode of Pay). */
  payment_modes: string[]
}

interface RegistrationSuccessData {
  reference: string
  visitor_name: string
  visitor_phone: string
  chapter_name: string
  meeting_title?: string | null
  referred_by_name?: string | null
  payment_mode?: string
  payment_amount?: string | number | null
  payment_receipt?: string
  registered_at: string
}

type ViewState = 'landing' | 'visitor' | 'substitute' | 'success'

export default function VisitorRegister() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PublicChapterInfo | null>(null)

  // Current view: 'landing' (two choices) | 'visitor' (form) | 'substitute' (form) | 'success' (confirmation)
  const [view, setView] = useState<ViewState>('landing')
  const [registrationSuccess, setRegistrationSuccess] = useState<RegistrationSuccessData | null>(null)
  const [copied, setCopied] = useState(false)

  function handleCopyRef() {
    if (!registrationSuccess?.reference) return
    navigator.clipboard.writeText(registrationSuccess.reference)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Form states - Visitor
  const [visitorName, setVisitorName] = useState('')
  const [visitorPhone, setVisitorPhone] = useState('')
  const [referredBy, setReferredBy] = useState('')
  const [visitorErrors, setVisitorErrors] = useState<Record<string, string>>({})

  // Form states - Substitute
  const [targetMemberId, setTargetMemberId] = useState('')
  const [substituteName, setSubstituteName] = useState('')
  const [substitutePhone, setSubstitutePhone] = useState('')
  const [substituteErrors, setSubstituteErrors] = useState<Record<string, string>>({})

  // Visitor payment: open the section, pick the mode of pay, enter the amount and save it before registering
  const [payOpen, setPayOpen] = useState(false)
  const [payMode, setPayMode] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!token) {
      setError('Registration token is missing from the link.')
      setLoading(false)
      return
    }

    async function fetchInfo() {
      setLoading(true)
      setError(null)
      const res = await apiRequest<PublicChapterInfo>(`/chapters/public/visitor/${token}/`)
      if (!active) return

      if (res.data) {
        setData(res.data)
      } else {
        setError(res.error || 'Invalid or inactive chapter registration link.')
      }
      setLoading(false)
    }

    fetchInfo()
    return () => {
      active = false
    }
  }, [token])

  // Validation
  function validateVisitor(): boolean {
    const errs: Record<string, string> = {}
    const trimmedName = visitorName.trim()
    if (!trimmedName || trimmedName.length < 2) {
      errs.name = 'Please enter your full name.'
    } else if (!/[a-zA-Z]/.test(trimmedName) && !/\p{L}/u.test(trimmedName)) {
      errs.name = 'Name must contain at least one letter.'
    }
    const cleanPhone = visitorPhone.replace(/\D/g, '').slice(0, 10)
    if (cleanPhone.length !== 10) {
      errs.phone = 'Please enter a valid 10-digit mobile number.'
    }
    setVisitorErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateSubstitute(): boolean {
    const errs: Record<string, string> = {}
    if (!targetMemberId) {
      errs.target = 'Please select the chapter member you are substituting for.'
    }
    if (!substituteName.trim() || substituteName.trim().length < 2) {
      errs.name = 'Please enter your name.'
    }
    const cleanPhone = substitutePhone.replace(/\D/g, '')
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      errs.phone = 'Please enter a valid phone number.'
    }
    setSubstituteErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Visitor registration is only open for today's meeting that hasn't finished yet
  const hasUpcomingMeeting = Boolean(data?.meeting && data.meeting.is_today && !data.meeting.is_finished)
  const visitorDisabledReason = data?.meeting?.is_today && data.meeting.is_finished
    ? "Today's meeting has already concluded."
    : data?.meeting && !data.meeting.is_today
      ? 'Visitor registration is only available on meeting day.'
      : 'No upcoming meetings are currently scheduled.'

  async function checkPhoneDuplicate(phone: string): Promise<{ isInvalid: boolean; message?: string }> {
    const clean = phone.replace(/\D/g, '').slice(0, 10)
    if (clean.length !== 10 || !token) return { isInvalid: false }
    const res = await apiRequest<{ exists: boolean; message?: string }>(
      `/chapters/public/visitor/${token}/check-phone/?phone=${encodeURIComponent(clean)}`
    )
    if (res.data?.exists) {
      const msg = res.data.message || 'This mobile number cannot be registered as a visitor.'
      setVisitorErrors((p) => ({ ...p, phone: msg }))
      return { isInvalid: true, message: msg }
    }
    return { isInvalid: false }
  }

  // Save: registers the visitor together with the payment typed in the Payment section
  async function handleVisitorSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!hasUpcomingMeeting) {
      setSubmitError(visitorDisabledReason)
      return
    }
    const valid = validateVisitor()
    const amount = Number(payAmount)
    if (!payMode || !(amount > 0)) {
      setVisitorErrors((p) => ({ ...p, payment: !payMode ? 'Select the mode of pay in the Payment section.' : 'Enter the amount in the Payment section.' }))
      setPayOpen(true)
      return
    }
    if (!valid) return

    setSubmitting(true)
    const phoneCheck = await checkPhoneDuplicate(visitorPhone)
    if (phoneCheck.isInvalid) {
      setSubmitting(false)
      setSubmitError(phoneCheck.message || 'This mobile number cannot be registered as a visitor.')
      return
    }

    const res = await apiRequest<{
      success: boolean
      reference: string
      visitor_name?: string
      chapter_name?: string
      meeting_title?: string | null
      referred_by_name?: string | null
      payment_mode?: string
      payment_amount?: string | number | null
      payment_receipt?: string
      registered_at?: string
    }>(
      `/chapters/public/visitor/${token}/register/`,
      {
        method: 'POST',
        body: JSON.stringify({
          visitor_name: visitorName.trim(),
          visitor_phone: visitorPhone.trim(),
          referred_by: referredBy || null,
          payment_mode: payMode,
          payment_amount: amount.toFixed(2),
        }),
      }
    )
    setSubmitting(false)

    if (res.data?.success && res.data?.reference) {
      setRegistrationSuccess({
        reference: res.data.reference,
        visitor_name: res.data.visitor_name || visitorName.trim(),
        visitor_phone: visitorPhone.trim(),
        chapter_name: res.data.chapter_name || (data?.chapter.name || ''),
        meeting_title: res.data.meeting_title || data?.meeting?.title,
        referred_by_name: res.data.referred_by_name || data?.members.find((m) => m.id === referredBy)?.name || null,
        payment_mode: res.data.payment_mode || payMode,
        payment_amount: res.data.payment_amount || amount.toFixed(2),
        payment_receipt: res.data.payment_receipt,
        registered_at: res.data.registered_at || new Date().toISOString(),
      })
      setView('success')
    } else {
      const phoneErr = (res.data as any)?.visitor_phone?.[0]
      if (phoneErr) {
        setVisitorErrors((p) => ({ ...p, phone: phoneErr }))
      }
      setSubmitError(phoneErr || res.error || 'Registration failed. Please try again.')
    }
  }

  // Handle Substitute check-in submit
  async function handleSubstituteSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!validateSubstitute()) return

    setSubmitting(true)
    const res = await apiRequest<{ success: boolean; reference: string }>(
      `/chapters/public/visitor/${token}/substitute/`,
      {
        method: 'POST',
        body: JSON.stringify({
          target_member_id: targetMemberId,
          substitute_name: substituteName.trim(),
          substitute_phone: substitutePhone.trim(),
        }),
      }
    )
    setSubmitting(false)

    if (res.data?.success && res.data?.reference) {
      navigate(`/visitor/welcome?ref=${res.data.reference}`)
    } else {
      setSubmitError(res.error || 'Substitute check-in failed. Please verify eligibility and retry.')
    }
  }

  return (
    <div className="visitor-portal">

      <main className="visitor-portal__card">
        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div className="spin" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--ink-mute)', fontSize: 14 }}>Loading chapter details...</p>
          </div>
        )}

        {/* Global error */}
        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '32px 8px' }}>
            <AlertCircle size={44} color="var(--danger)" style={{ margin: '0 auto 14px' }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>
              Invalid Registration Link
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-mute)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>
              {error}
            </p>
          </div>
        )}

        {data && !loading && (
          <div>
            {/* =========================================================================
                STATE 1: PUBLIC LANDING PAGE (EXACTLY TWO SELECTABLE CARDS)
               ========================================================================= */}
            {view === 'landing' && (
              <div>
                <div className="visitor-portal__top">
                  <BrandMark size={54} />
                  <h1 className="visitor-portal__title">Welcome to {data.chapter.name}</h1>
                  <p className="visitor-portal__sub">Please select an option to continue</p>
                </div>

                {/* Meeting information pill */}
                {data.meeting && (
                  <div className="visitor-portal__meeting">
                    <Calendar size={15} color="var(--brand)" style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong>{data.meeting.title}</strong>
                      {data.meeting.is_today && (
                        <span className="stat stat--ok" style={{ height: 20, padding: '0 8px', fontSize: 10, marginLeft: 6 }}>
                          Today
                        </span>
                      )}
                      <div style={{ color: 'var(--ink-mute)', fontSize: 11.5, marginTop: 2 }}>
                        {fmtDate(data.meeting.starts_at, { weekday: 'short', day: 'numeric', month: 'short' })},{' '}
                        {fmtTime(data.meeting.starts_at)}
                        {data.meeting.venue ? ` · ${data.meeting.venue}` : ''}
                      </div>
                    </div>
                  </div>
                )}

                {/* Exactly two primary selectable options */}
                <div className="visitor-options">
                  {/* Option 1: I'm a Visitor */}
                  <button
                    type="button"
                    className="visitor-option-card"
                    disabled={!hasUpcomingMeeting}
                    onClick={() => {
                      if (hasUpcomingMeeting) {
                        setView('visitor')
                        setSubmitError(null)
                      }
                    }}
                    aria-label="I am a Visitor"
                  >
                    <div className="visitor-option-card__icon">
                      <Glyph icon={UserPlus} tone={hasUpcomingMeeting ? 'red' : 'gold'} size={52} />
                    </div>
                    <div className="visitor-option-card__body">
                      <div className="visitor-option-card__title">
                        <span>I'm a Visitor</span>
                        {!hasUpcomingMeeting && (
                          <span className="stat stat--idle" style={{ height: 20, padding: '0 8px', fontSize: 10.5, fontWeight: 600 }}>
                            Unavailable
                          </span>
                        )}
                      </div>
                      <p className="visitor-option-card__desc">
                        {hasUpcomingMeeting
                          ? 'Attending as an invited guest or exploring chapter membership.'
                          : visitorDisabledReason}
                      </p>
                    </div>
                    {hasUpcomingMeeting && (
                      <ChevronRight size={22} className="visitor-option-card__arrow" />
                    )}
                  </button>

                  {/* Option 2: I'm a Substitute */}
                  <button
                    type="button"
                    className="visitor-option-card"
                    disabled={!data.substitute_enabled}
                    onClick={() => {
                      if (data.substitute_enabled) {
                        setView('substitute')
                        setSubmitError(null)
                      }
                    }}
                    aria-label="I am a Substitute"
                  >
                    <div className="visitor-option-card__icon">
                      <Glyph icon={UserCheck} tone={data.substitute_enabled ? 'navy' : 'gold'} size={52} />
                    </div>
                    <div className="visitor-option-card__body">
                      <div className="visitor-option-card__title">
                        <span>I'm a Substitute</span>
                        {!data.substitute_enabled && (
                          <span className="stat stat--idle" style={{ height: 20, padding: '0 8px', fontSize: 10.5, fontWeight: 600 }}>
                            Unavailable
                          </span>
                        )}
                      </div>
                      <p className="visitor-option-card__desc">
                        {data.substitute_enabled
                          ? 'Standing in and representing an active chapter member today.'
                          : data.substitute_disabled_reason || 'Substitute check-in is only available on meeting day.'}
                      </p>
                    </div>
                    {data.substitute_enabled && (
                      <ChevronRight size={22} className="visitor-option-card__arrow" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* =========================================================================
                STATE 2: VISITOR FORM
               ========================================================================= */}
            {view === 'visitor' && (
              <div>
                <button
                  type="button"
                  className="visitor-portal__back"
                  onClick={() => {
                    setView('landing')
                    setSubmitError(null)
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>Back to options</span>
                </button>

                <div className="visitor-portal__top" style={{ marginBottom: 20 }}>
                  <span className="chip chip--gold" style={{ marginBottom: 4 }}>
                    {data.chapter.name}
                  </span>
                  <h2 className="visitor-portal__title" style={{ fontSize: 23 }}>Visitor Registration</h2>
                  <p className="visitor-portal__sub">Please enter your details to register your visit.</p>
                </div>

                {submitError && (
                  <div className="form-error" style={{ marginBottom: 16 }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{submitError}</span>
                  </div>
                )}

                <form onSubmit={handleVisitorSubmit} className="form-stack">
                  {/* Visitor Name */}
                  <Field label="Your Full Name" required error={visitorErrors.name}>
                    <input
                      className="field__control"
                      placeholder="e.g. Rahul Sharma"
                      value={visitorName}
                      onChange={(e) => {
                        setVisitorName(e.target.value)
                        if (visitorErrors.name) setVisitorErrors((p) => ({ ...p, name: '' }))
                      }}
                      onBlur={() => {
                        const trimmed = visitorName.trim()
                        if (trimmed) {
                          if (trimmed.length < 2) {
                            setVisitorErrors((p) => ({ ...p, name: 'Please enter your full name.' }))
                          } else if (!/[a-zA-Z]/.test(trimmed) && !/\p{L}/u.test(trimmed)) {
                            setVisitorErrors((p) => ({ ...p, name: 'Name must contain at least one letter.' }))
                          }
                        }
                      }}
                      autoFocus
                    />
                  </Field>

                  {/* Visitor Phone */}
                  <Field label="Mobile Number" required error={visitorErrors.phone}>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      className="field__control"
                      placeholder="10-digit mobile number"
                      value={visitorPhone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                        setVisitorPhone(digits)
                        if (visitorErrors.phone) setVisitorErrors((p) => ({ ...p, phone: '' }))
                      }}
                      onPaste={(e) => {
                        e.preventDefault()
                        const pasted = e.clipboardData.getData('text') || ''
                        const digits = pasted.replace(/\D/g, '').slice(0, 10)
                        setVisitorPhone(digits)
                        if (visitorErrors.phone) setVisitorErrors((p) => ({ ...p, phone: '' }))
                        if (digits.length === 10) {
                          checkPhoneDuplicate(digits)
                        }
                      }}
                      onBlur={() => {
                        if (visitorPhone.length === 10) {
                          checkPhoneDuplicate(visitorPhone)
                        }
                      }}
                    />
                  </Field>

                  {/* Referred By Dropdown */}
                  <Field label="Referred By (Optional)">
                    <SearchSelect
                      value={referredBy}
                      onChange={setReferredBy}
                      placeholder="-- Select Member (Optional) --"
                      searchPlaceholder="Search members"
                      options={data.members.map((m) => ({ id: m.id, name: m.name, sub: m.organisation }))}
                    />
                  </Field>

                  {/* Payment: opens to pick the mode of pay (the chapter's list) and enter the amount */}
                  <div className={`visitor-pay ${visitorErrors.payment ? 'is-invalid' : ''}`}>
                    <button type="button" className="visitor-pay__head" aria-expanded={payOpen} onClick={() => setPayOpen((o) => !o)}>
                      <span className="visitor-pay__ico">
                        <CreditCard size={18} />
                      </span>
                      <span className="visitor-pay__title">
                        <b>
                          Payment <span style={{ color: 'var(--danger)' }}>*</span>
                        </b>
                        <small>{payMode && Number(payAmount) > 0 ? `${payMode} · Rs. ${Number(payAmount).toLocaleString('en-IN')}` : 'Choose the mode of pay and enter the amount'}</small>
                      </span>
                      <ChevronDown size={18} className={payOpen ? 'is-up' : ''} />
                    </button>
                    {payOpen && (
                      <div className="visitor-pay__body">
                        <Field label="Mode of pay" required>
                          <SearchSelect
                            value={payMode}
                            onChange={(id) => {
                              setPayMode(id)
                              setVisitorErrors((p) => ({ ...p, payment: '' }))
                            }}
                            placeholder="-- Select mode of pay --"
                            searchable={false}
                            options={data.payment_modes.map((m) => ({ id: m, name: m }))}
                          />
                        </Field>
                        <Field label="Amount (Rs.)" required>
                          <input
                            className="field__control"
                            inputMode="decimal"
                            placeholder="e.g. 500"
                            value={payAmount}
                            onChange={(e) => {
                              setPayAmount(e.target.value.replace(/[^\d.]/g, ''))
                              setVisitorErrors((p) => ({ ...p, payment: '' }))
                            }}
                          />
                        </Field>
                      </div>
                    )}
                    {visitorErrors.payment && <span className="field__error">{visitorErrors.payment}</span>}
                  </div>

                  <button type="submit" className="btn btn--primary btn--block login__submit" disabled={submitting}>
                    <Check size={17} />
                    <span>{submitting ? 'Saving...' : 'Save'}</span>
                  </button>
                </form>
              </div>
            )}

            {/* =========================================================================
                STATE 3: SUBSTITUTE FORM
               ========================================================================= */}
            {view === 'substitute' && (
              <div>
                <button
                  type="button"
                  className="visitor-portal__back"
                  onClick={() => {
                    setView('landing')
                    setSubmitError(null)
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>Back to options</span>
                </button>

                <div className="visitor-portal__top" style={{ marginBottom: 20 }}>
                  <span className="stat stat--ok" style={{ marginBottom: 4 }}>
                    {data.chapter.name}
                  </span>
                  <h2 className="visitor-portal__title" style={{ fontSize: 23 }}>Substitute Check-in</h2>
                  <p className="visitor-portal__sub">Standing in for a member for today's meeting.</p>
                </div>

                {submitError && (
                  <div className="form-error" style={{ marginBottom: 16 }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{submitError}</span>
                  </div>
                )}

                {data.substitute_eligible_members.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                    <p style={{ fontSize: 13.5, color: 'var(--ink-mute)' }}>
                      All members of this chapter have already checked in for today's meeting.
                    </p>
                    <button
                      type="button"
                      className="btn btn--line"
                      style={{ marginTop: 12 }}
                      onClick={() => setView('landing')}
                    >
                      Return to Welcome Screen
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubstituteSubmit} className="form-stack">
                    {/* For whom */}
                    <Field
                      label="Standing in For (Chapter Member)"
                      required
                      error={substituteErrors.target}
                    >
                      <SearchSelect
                        value={targetMemberId}
                        onChange={(id) => {
                          setTargetMemberId(id)
                          if (substituteErrors.target) setSubstituteErrors((p) => ({ ...p, target: '' }))
                        }}
                        placeholder="-- Choose Member to Substitute --"
                        searchPlaceholder="Search members"
                        options={data.substitute_eligible_members.map((m) => ({
                          id: m.id,
                          name: m.name,
                          sub: m.organisation,
                        }))}
                      />
                    </Field>

                    {/* Substitute Name */}
                    <Field label="Your Name (Substitute)" required error={substituteErrors.name}>
                      <input
                        className="field__control"
                        placeholder="Your full name"
                        value={substituteName}
                        onChange={(e) => {
                          setSubstituteName(e.target.value)
                          if (substituteErrors.name) setSubstituteErrors((p) => ({ ...p, name: '' }))
                        }}
                      />
                    </Field>

                    {/* Substitute Phone */}
                    <Field label="Your Mobile Number" required error={substituteErrors.phone}>
                      <input
                        type="tel"
                        className="field__control"
                        placeholder="10-digit mobile number"
                        value={substitutePhone}
                        onChange={(e) => {
                          setSubstitutePhone(e.target.value)
                          if (substituteErrors.phone) setSubstituteErrors((p) => ({ ...p, phone: '' }))
                        }}
                      />
                    </Field>

                    <div
                      style={{
                        background: 'rgba(5, 122, 85, 0.05)',
                        border: '1px solid rgba(5, 122, 85, 0.15)',
                        borderRadius: 12,
                        padding: '10px 14px',
                        fontSize: 12,
                        color: 'var(--ink-soft)',
                        lineHeight: 1.5,
                      }}
                    >
                      Attendance for the selected chapter member will be automatically credited with method 'Substitute'.
                    </div>

                    <button
                      type="submit"
                      className="btn btn--primary btn--block login__submit"
                      disabled={submitting}
                    >
                      <UserCheck size={16} />
                      <span>{submitting ? 'Checking In...' : 'Confirm Substitute Check-in'}</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* =========================================================================
                STATE 4: VISITOR REGISTRATION SUCCESSFUL PAGE
               ========================================================================= */}
            {view === 'success' && registrationSuccess && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <Glyph icon={CheckCircle2} tone="green" size={56} />
                </div>

                <span
                  className="chip chip--gold"
                  style={{ marginBottom: 8, display: 'inline-block' }}
                >
                  Visitor Registration
                </span>

                <h1 className="visitor-portal__title" style={{ color: 'var(--ink)', fontSize: 24 }}>
                  Registration Successful
                </h1>
                <p className="visitor-portal__sub" style={{ marginTop: 4, marginBottom: 20 }}>
                  Welcome to <strong>{registrationSuccess.chapter_name}</strong>
                </p>

                {/* Registration Summary Card */}
                <div
                  style={{
                    background: 'rgba(20, 32, 31, 0.03)',
                    border: '1px solid var(--line)',
                    borderRadius: 18,
                    padding: '18px 20px',
                    textAlign: 'left',
                    fontSize: 13,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ color: 'var(--ink-mute)' }}>Registrant</span>
                    <strong style={{ color: 'var(--ink)' }}>{registrationSuccess.visitor_name}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ color: 'var(--ink-mute)' }}>Mobile Number</span>
                    <strong style={{ color: 'var(--ink)' }}>{registrationSuccess.visitor_phone}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ color: 'var(--ink-mute)' }}>Chapter</span>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{registrationSuccess.chapter_name}</span>
                  </div>

                  {registrationSuccess.referred_by_name && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ color: 'var(--ink-mute)' }}>Referred By</span>
                      <strong style={{ color: 'var(--ink)' }}>{registrationSuccess.referred_by_name}</strong>
                    </div>
                  )}

                  {registrationSuccess.payment_mode && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ color: 'var(--ink-mute)' }}>Payment</span>
                      <strong style={{ color: 'var(--ink)' }}>
                        {registrationSuccess.payment_mode} · Rs. {Number(registrationSuccess.payment_amount).toLocaleString('en-IN')}
                      </strong>
                    </div>
                  )}

                  {registrationSuccess.payment_receipt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ color: 'var(--ink-mute)' }}>Receipt No.</span>
                      <strong style={{ color: 'var(--green)' }}>{registrationSuccess.payment_receipt}</strong>
                    </div>
                  )}

                  {registrationSuccess.meeting_title && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ color: 'var(--ink-mute)' }}>Meeting</span>
                      <span style={{ color: 'var(--ink)', fontWeight: 600, textAlign: 'right' }}>
                        {registrationSuccess.meeting_title}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ color: 'var(--ink-mute)' }}>Check-in Time</span>
                    <span style={{ color: 'var(--ink-soft)' }}>
                      {fmtDate(registrationSuccess.registered_at, { day: 'numeric', month: 'short', year: 'numeric' })},{' '}
                      {fmtTime(registrationSuccess.registered_at)}
                    </span>
                  </div>

                  <div
                    style={{
                      borderTop: '1px dashed var(--line)',
                      paddingTop: 10,
                      marginTop: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Registration Reference
                      </div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>
                        {registrationSuccess.reference}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyRef}
                      className="iconbtn"
                      title="Copy reference code"
                      style={{ width: 34, height: 34 }}
                    >
                      {copied ? <Check size={15} color="var(--green)" /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.6, margin: '0 0 16px' }}>
                  Please proceed to the Visitor Host welcome desk. Our team is excited to meet you!
                </p>

                <button
                  type="button"
                  className="btn btn--block visitor-portal__btn-welcome"
                  onClick={() => {
                    setVisitorName('')
                    setVisitorPhone('')
                    setReferredBy('')
                    setPayMode('')
                    setPayAmount('')
                    setPayOpen(false)
                    setRegistrationSuccess(null)
                    setView('landing')
                  }}
                >
                  Back to Welcome Page
                </button>
              </div>
            )}
          </div>
        )}

        <footer className="visitor-portal__footer">
          <span>Powered by Geosys IT Solutions</span>
        </footer>
      </main>
    </div>
  )
}
