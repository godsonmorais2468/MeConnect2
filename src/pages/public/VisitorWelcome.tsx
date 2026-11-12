import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react'
import { BrandMark, Glyph } from '../../components/ui'
import { apiRequest } from '../../lib/api'
import { fmtDate, fmtTime } from '../../lib/format'
import { useToast } from '../../lib/toast'

interface RegistrationDetail {
  registration_type: 'visitor' | 'substitute'
  reference: string
  name: string
  chapter_name: string
  meeting_title?: string | null
  meeting_starts_at?: string | null
  referred_by_name?: string | null
  substituting_for_name?: string | null
  payment_status?: string
  payment_mode?: string
  payment_amount?: string | number | null
  payment_receipt?: string
  registered_at: string
}

export default function VisitorWelcome() {
  const [params] = useSearchParams()
  const ref = params.get('ref') || ''
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<RegistrationDetail | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    if (!ref) {
      setError('Registration reference missing.')
      setLoading(false)
      return
    }

    async function loadConfirmation() {
      setLoading(true)
      setError(null)
      const res = await apiRequest<RegistrationDetail>(`/chapters/public/registration/${ref}/`)
      if (!active) return

      if (res.data) {
        setData(res.data)
      } else {
        setError(res.error || 'Registration details not found. The reference may be invalid or expired.')
      }
      setLoading(false)
    }

    loadConfirmation()
    return () => {
      active = false
    }
  }, [ref])

  function handleCopyRef() {
    if (!data?.reference) return
    navigator.clipboard.writeText(data.reference)
    setCopied(true)
    toast('Reference copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const isVisitor = data?.registration_type === 'visitor'

  return (
    <div className="visitor-portal">

      <main className="visitor-portal__card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <BrandMark size={54} />
        </div>

        {loading && (
          <div style={{ padding: '40px 0' }}>
            <div className="spin" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--ink-mute)', fontSize: 13.5 }}>Loading confirmation...</p>
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: '24px 0' }}>
            <AlertCircle size={44} color="var(--danger)" style={{ margin: '0 auto 12px' }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>Reference Not Found</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-mute)', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
              {error}
            </p>
          </div>
        )}

        {data && !loading && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <Glyph icon={CheckCircle2} tone="green" size={56} />
            </div>

            <span
              className={isVisitor ? 'chip chip--gold' : 'stat stat--ok'}
              style={{ marginBottom: 8, display: 'inline-block' }}
            >
              {isVisitor ? 'Visitor Registration' : 'Substitute Check-in'}
            </span>

            <h1 className="visitor-portal__title" style={{ color: 'var(--ink)', fontSize: 24 }}>
              Registration Successful
            </h1>
            <p className="visitor-portal__sub" style={{ marginTop: 4, marginBottom: 20 }}>
              Welcome to <strong>{data.chapter_name}</strong>
            </p>

            {/* Receipt Summary Card */}
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
                <strong style={{ color: 'var(--ink)' }}>{data.name}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: 'var(--ink-mute)' }}>Chapter</span>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{data.chapter_name}</span>
              </div>

              {isVisitor && data.referred_by_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: 'var(--ink-mute)' }}>Referred By</span>
                  <strong style={{ color: 'var(--ink)' }}>{data.referred_by_name}</strong>
                </div>
              )}

              {isVisitor && data.payment_receipt && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ color: 'var(--ink-mute)' }}>Payment</span>
                    <strong style={{ color: 'var(--ink)' }}>
                      {data.payment_mode} · Rs. {Number(data.payment_amount).toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ color: 'var(--ink-mute)' }}>Receipt No.</span>
                    <strong style={{ color: 'var(--green)' }}>{data.payment_receipt}</strong>
                  </div>
                </>
              )}

              {!isVisitor && data.substituting_for_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: 'var(--ink-mute)' }}>Substituting For</span>
                  <strong style={{ color: 'var(--green)' }}>{data.substituting_for_name}</strong>
                </div>
              )}

              {data.meeting_title && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: 'var(--ink-mute)' }}>Meeting</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 600, textAlign: 'right' }}>
                    {data.meeting_title}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: 'var(--ink-mute)' }}>Check-in Time</span>
                <span style={{ color: 'var(--ink-soft)' }}>
                  {fmtDate(data.registered_at, { day: 'numeric', month: 'short', year: 'numeric' })},{' '}
                  {fmtTime(data.registered_at)}
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
                    {data.reference}
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

            {isVisitor ? (
              <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.6, margin: '0 0 16px' }}>
                Please proceed to the Visitor Host welcome desk. Our team is excited to meet you!
              </p>
            ) : (
              <div
                style={{
                  background: 'rgba(5, 122, 85, 0.05)',
                  border: '1px solid rgba(5, 122, 85, 0.15)',
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontSize: 12.5,
                  color: 'var(--green)',
                  fontWeight: 500,
                  marginBottom: 16,
                  lineHeight: 1.5,
                }}
              >
                Attendance for <strong>{data.substituting_for_name}</strong> has been credited for today's meeting.
              </div>
            )}

            <button
              type="button"
              className="btn btn--block visitor-portal__btn-welcome"
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back()
                } else {
                  window.location.href = '/'
                }
              }}
            >
              Back to Welcome Page
            </button>
          </div>
        )}

        <footer className="visitor-portal__footer">
          <span>Powered by Geosys IT Solutions</span>
        </footer>
      </main>
    </div>
  )
}
