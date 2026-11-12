import { useEffect, useState } from 'react'
import { AlertCircle, Check, Copy, Download, ExternalLink, ScanLine, ShieldCheck, UserCheck, UserPlus, Printer } from 'lucide-react'
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

/** Visitor Host QR: the standee itself is the page. A poster with the code, and three steps for the welcome desk. */
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

  const registrationUrl = data ? `${window.location.origin}/visitor/register?token=${data.visitor_token}` : ''

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
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to generate PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="page vq">
      {loading && (
        <div className="vq-state">
          <div className="spin" />
          <p>Generating secure QR code...</p>
        </div>
      )}

      {error && (
        <div className="vq-state vq-state--bad">
          <AlertCircle size={36} />
          <h2>Access Denied or Not Available</h2>
          <p>{error}</p>
        </div>
      )}

      {data && !loading && (
        <div className="vq-stage">
          <section className="vq-poster" aria-label="Visitor standee">
            <span className="vq-poster__badge">
              <ShieldCheck size={14} /> Official Standee QR
            </span>
            <p className="vq-poster__eyebrow">Visitor Host QR · {chapter?.name || 'your chapter'}</p>
            <h1>{data.chapter_name}</h1>
            <p className="vq-poster__lead">Scan to register as a visitor or check in as a substitute.</p>

            {/* Rendered client-side from the trusted registration URL so the scanned QR always matches the copied link, the PDF and the Open Page action (never a server-echoed origin). */}
            <div className="vq-qr">
              <i className="vq-qr__c vq-qr__c--tl" />
              <i className="vq-qr__c vq-qr__c--tr" />
              <i className="vq-qr__c vq-qr__c--bl" />
              <i className="vq-qr__c vq-qr__c--br" />
              <span className="vq-qr__scan" aria-hidden />
              <QrCode text={registrationUrl} size={232} />
            </div>

            <p className="vq-poster__hint">
              <ScanLine size={15} /> Point any phone camera at the code
            </p>

            <div className="vq-acts">
              <button type="button" className="vq-btn" onClick={handleDownloadPdf} disabled={downloading}>
                <Download size={16} />
                <span>{downloading ? 'Preparing...' : 'Download Standee (A5 PDF)'}</span>
              </button>
              <button type="button" className="vq-btn vq-btn--glass" onClick={handleCopy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>
              <a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="vq-btn vq-btn--glass" title="Open public registration page in new tab">
                <ExternalLink size={16} />
                <span>Open Page</span>
              </a>
            </div>
          </section>

          <aside className="vq-guide" aria-label="Visitor host guidelines">
            <h2>Visitor Host Guidelines</h2>
            <ol>
              <li>
                <span className="vq-guide__ico">
                  <Printer size={18} />
                </span>
                <div>
                  <b>Print and display</b>
                  <p>
                    Print the downloaded <strong>A5 Portrait Standee</strong> and display it at the Visitor Welcome Desk during chapter meetings.
                  </p>
                </div>
              </li>
              <li>
                <span className="vq-guide__ico">
                  <UserPlus size={18} />
                </span>
                <div>
                  <b>First-time visitors</b>
                  <p>Scan the QR, select their referring member, review the simulated payment, and register.</p>
                </div>
              </li>
              <li>
                <span className="vq-guide__ico">
                  <UserCheck size={18} />
                </span>
                <div>
                  <b>Substitutes</b>
                  <p>Scan the QR, select the member they are standing in for, and check in. Attendance is marked automatically for that member.</p>
                </div>
              </li>
            </ol>
            <p className="vq-guide__note">
              <ShieldCheck size={16} />
              <span>
                The QR holds a permanent, secure chapter token that does not expire between meetings. A substitute is recorded under <strong>Method: Substitute</strong>, and duplicate check-ins are prevented.
              </span>
            </p>
          </aside>
        </div>
      )}
    </div>
  )
}
