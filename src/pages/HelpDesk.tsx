import { Clock, Headset, Mail, Phone, ShieldCheck } from 'lucide-react'
import { Glyph, PageHead } from '../components/ui'
import geosysLogo from '../assets/geosys-logo.png'
import { SUPPORT_EMAIL as EMAIL, SUPPORT_PHONES as PHONES } from '../data/support'
import { useNow } from '../lib/hooks'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const OPENS = 10 * 60
const CLOSES = 17 * 60

/** Whether the support team is at their desk now. Their hours are Mon to Fri, 10:00 am to 5:00 pm, India time. */
function supportStatus(now: number) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date(now))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const day = get('weekday')
  const minutes = (Number(get('hour')) % 24) * 60 + Number(get('minute'))
  const workday = DAYS.includes(day)
  if (workday && minutes >= OPENS && minutes < CLOSES) return { open: true, text: 'Open now · until 5:00 pm' }
  if (workday && minutes < OPENS) return { open: false, text: 'Closed · opens today at 10:00 am' }
  return { open: false, text: day === 'Fri' || day === 'Sat' || day === 'Sun' ? 'Closed · opens Monday at 10:00 am' : 'Closed · opens tomorrow at 10:00 am' }
}

/** Where members and admins go for help with the app. */
export default function HelpDesk() {
  const status = supportStatus(useNow(60_000))
  return (
    <div className="page">
      <PageHead eyebrow="Support" icon={Headset} tone="navy" title="Help Desk" subtitle="Need a hand with the app? Reach the support team by phone or email." />

      <div className="help">
        <section className="help-hero">
          <img className="help-hero__logo" src={geosysLogo} alt="Geosys IT Solutions Pvt Ltd, ISO 9001:2015 certified" decoding="async" />
          <div className="help-hero__text">
            <h2>We are here to help</h2>
            <p>The Geosys support team looks after this app. Call or write to us and we will sort it out.</p>
            <span className={`stat ${status.open ? 'stat--ok' : 'stat--idle'}`}>{status.text}</span>
          </div>
        </section>

        <div className="help-grid">
          <article className="help-card">
            <Glyph icon={Phone} tone="red" size={48} />
            <h2>Call support</h2>
            <p>Tap a number to call.</p>
            <div className="help-actions">
              {PHONES.map((p) => (
                <a className="help-link" key={p} href={`tel:${p.replace(/\s/g, '')}`}>
                  <Phone size={16} /> {p}
                </a>
              ))}
            </div>
          </article>

          <article className="help-card">
            <Glyph icon={Mail} tone="navy" size={48} />
            <h2>Email us</h2>
            <p>Write to us and we will reply as soon as we can.</p>
            <div className="help-actions">
              <a className="help-link help-link--mail" href={`mailto:${EMAIL}`}>
                <Mail size={16} /> {EMAIL}
              </a>
            </div>
          </article>

          <article className="help-card">
            <Glyph icon={Clock} tone="gold" size={48} />
            <h2>Support hours</h2>
            <p>Our team is available on working days.</p>
            <dl className="help-hours">
              <div>
                <dt>Mon – Fri</dt>
                <dd>10:00 am – 05:00 pm</dd>
              </div>
              <div>
                <dt>Sat – Sun</dt>
                <dd>Closed</dd>
              </div>
            </dl>
          </article>
        </div>

        <footer className="help-foot">
          <p>Developed by Geosys IT Solutions Pvt Ltd, Pattom, Trivandrum — Since 2008.</p>
          <span className="chip">
            <ShieldCheck size={14} /> ISO 9001:2015 certified
          </span>
        </footer>
      </div>
    </div>
  )
}
