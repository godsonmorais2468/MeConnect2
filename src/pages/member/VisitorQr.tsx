import { useEffect, useState } from 'react'
import { Download, ExternalLink, Copy, Check, Sparkles, UserCheck, ShieldCheck, AlertCircle } from 'lucide-react'
import { PageHead } from '../../components/ui'
import QrCode from '../../components/QrCode'
import { apiRequest } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { downloadVisitorStandeePdf } from '../../lib/visitorPdf'

interface VisitorQrData {
  chapter_id: string
  chapter_name: string
  chapter_code: string
  visitor_token: string
  registration_url: string
  host_name: string
  chapter_lead_name: string | null
  qr_data_url: string
}

export default function VisitorQr() {
  const { chapter } = useAuth()
  const toast = useToast()
  const [data, setData] = useState<VisitorQrData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      const originParam = encodeURIComponent(window.location.origin)
      const res = await apiRequest<VisitorQrData>(`/regions/visitor-qr/?frontend_origin=${originParam}`)
      if (!active) return
      if (res.data) {
        setData(res.data)
      } else {
        setError(res.error || 'Failed to load Visitor Host QR code.')
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const registrationUrl = data
    ? `${window.location.origin}/visitor/register?token=${data.visitor_token}`
    : ''

  function handleCopy() {
    if (!registrationUrl) return
    navigator.clipboard.writeText(registrationUrl)
    setCopied(true)
    toast('Public registration link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownloadPdf() {
    if (!data || !registrationUrl) return
    setDownloading(true)
    try {
      downloadVisitorStandeePdf({
        chapterName: data.chapter_name,
        registrationUrl: registrationUrl,
      })
      toast('A5 Standee PDF downloaded!')
    } catch (e: any) {
      toast(e?.message || 'Failed to generate PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="page page--wide">
      <PageHead
        title="Visitor Host QR"
        subtitle={`Permanent registration and substitute check-in QR code for ${chapter?.name || 'your chapter'}.`}
        actions={
          data ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              <Download size={16} />
              <span>{downloading ? 'Preparing...' : 'Download Standee (A5 PDF)'}</span>
            </button>
          ) : undefined
        }
      />

      {loading && (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div className="spin" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--ink-mute)', fontSize: 14 }}>Generating secure QR code...</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: 32, textAlign: 'center', borderColor: 'var(--danger)' }}>
          <AlertCircle size={36} color="var(--danger)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Access Denied or Not Available</h3>
          <p style={{ color: 'var(--ink-mute)', fontSize: 14, maxWidth: 460, margin: '0 auto' }}>{error}</p>
        </div>
      )}

      {data && !loading && (
        <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>
          {/* Main QR Card */}
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ marginBottom: 16 }}>
              <span className="chip chip--gold" style={{ marginBottom: 8, display: 'inline-flex' }}>
                <ShieldCheck size={13} /> Official Standee QR
              </span>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{data.chapter_name}</h2>
            </div>

            <div
              style={{
                display: 'inline-block',
                padding: 16,
                background: '#ffffff',
                borderRadius: 20,
                boxShadow: '0 12px 32px -8px rgba(20, 32, 31, 0.15)',
                border: '1px solid var(--line)',
                margin: '12px auto 20px',
              }}
            >
              {/* Rendered client-side from the trusted registration URL so the
                  scanned QR always matches the copied link, PDF, and Open Page
                  action (never a server-echoed origin). */}
              <QrCode text={registrationUrl} size={240} />
            </div>

            <p style={{ fontSize: 12, color: 'var(--ink-mute)', maxWidth: 320, margin: '0 auto 20px' }}>
              Point any smartphone camera at this QR code to open the Visitor Registration & Substitute Check-in portal.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleDownloadPdf}
                disabled={downloading}
              >
                <Download size={16} />
                <span>{downloading ? 'Preparing...' : 'Download Standee (A5 PDF)'}</span>
              </button>
              <button type="button" className="btn btn--secondary" onClick={handleCopy}>
                {copied ? <Check size={16} color="var(--green)" /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>
              <a
                href={registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--secondary"
                title="Open public registration page in new tab"
              >
                <ExternalLink size={16} />
                <span>Open Page</span>
              </a>
            </div>
          </div>

          {/* Instructions & Guidelines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="var(--gold)" />
                Visitor Host Guidelines
              </h3>
              <ul style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
                <li>Print the downloaded <strong>A5 Portrait Standee</strong> and display it at the Visitor Welcome Desk during chapter meetings.</li>
                <li><strong>First-time Visitors:</strong> Scan the QR, select their referring member, review the simulated payment, and register.</li>
                <li><strong>Substitutes:</strong> Scan the QR, select the member they are standing in for, and check in. Attendance is marked automatically for the target member.</li>
                <li>The QR code contains a permanent, secure chapter token that does not expire between meetings.</li>
              </ul>
            </div>

            <div className="card" style={{ padding: 24, background: 'rgba(13, 110, 97, 0.03)', borderColor: 'rgba(13, 110, 97, 0.15)' }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserCheck size={16} />
                Automatic Substitute Attendance
              </h4>
              <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
                When a substitute successfully completes registration, our system automatically records attendance for the substituted member under <strong>Method: Substitute</strong>. Duplicate check-ins are prevented.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
