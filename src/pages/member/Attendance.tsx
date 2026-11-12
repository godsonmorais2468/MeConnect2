import { useEffect, useRef, useState } from 'react'
import { CalendarCheck, CalendarClock, CircleCheck, Clock, LocateFixed, MapPin, ScanLine, Users, Video } from 'lucide-react'
import QrCode from '../../components/QrCode'
import QrScanner from '../../components/QrScanner'
import { Glyph, PageHead, Sheet } from '../../components/ui'
import { OPENS_BEFORE_MIN, QR_STEP_MS, currentMeeting, distanceM, isCoordinator, parseCode, phaseOf, qrCodeFor, qrPayload, windowOf } from '../../lib/attendance'
import { useAuth } from '../../lib/auth'
import { fmtDate, fmtTime } from '../../lib/format'
import { useNow } from '../../lib/hooks'
import { markAttendance, useDB } from '../../lib/store'
import { designationsOf } from '../../lib/designations'
import { useToast } from '../../lib/toast'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import type { AttendanceMethod, Meeting } from '../../lib/types'

const METHOD: Record<AttendanceMethod, string> = { online: 'online', qr: 'by scanning the QR code', geofence: 'by location', substitute: 'through a substitute', manual: 'by the head table' }
const iso = (ms: number) => new Date(ms).toISOString()

export default function Attendance() {
  const { member } = useAuth()
  const db = useDB()
  const [q, setQ] = useState('')
  const toast = useToast()
  const now = useNow(15_000)
  const [scanning, setScanning] = useState(false)
  const [scanKey, setScanKey] = useState(0)
  const [scanError, setScanError] = useState('')
  const [onlineError, setOnlineError] = useState('')

  if (!member) return null

  const meetings = db.meetings.filter((m) => m.chapterId === member.chapterId)
  const meeting = currentMeeting(meetings, now)
  const phase = meeting ? phaseOf(meeting, now) : 'ended'
  const mine = meeting ? db.attendance.find((a) => a.meetingId === meeting.id && a.memberId === member.id) : undefined
  const coordinator = isCoordinator(member.designation) || designationsOf(db, member.regionId, member.chapterId).some((d) => d.name === member.designation && d.isActive && d.permissions?.includes('Attendance'))

  async function markOnline() {
    if (!meeting || !member) return
    const res = await markAttendance(member.id, meeting.id, { method: 'online' })
    if (res.error) return setOnlineError(res.error)
    toast('Attendance marked')
  }

  async function scanned(text: string) {
    if (!meeting || !member) return
    const code = parseCode(text, meeting.id)
    const res = code ? await markAttendance(member.id, meeting.id, { method: 'qr', code }) : { error: 'This QR code is not for this meeting.' }
    if (res.error) {
      setScanError(res.error)
      setScanKey((k) => k + 1)
      return
    }
    setScanning(false)
    setScanError('')
    toast('Attendance marked')
  }

  const past = meetings
    .filter((m) => m.id !== meeting?.id && phaseOf(m, now) === 'ended')
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    .slice(0, 6)
  const shownPast = past.filter((m) => matches(q, m.title, m.venue, m.mode, fmtDate(m.startsAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })))
  const mates = db.members.filter((m) => m.chapterId === member.chapterId && m.loginEnabled !== false)

  return (
    <div className="page">
      <PageHead
        eyebrow="Meetings"
        icon={CalendarCheck}
        tone="green"
        title="Attendance"
        subtitle={meeting ? 'Mark your attendance for your chapter meeting.' : 'Your chapter has no meetings yet.'}
      />

      {!meeting ? (
        <div className="empty">
          <b>No meetings scheduled.</b>
          Your region admin creates meetings. They will appear here.
        </div>
      ) : (
        <div className="att">
          <MeetingCard meeting={meeting} now={now} />

          {mine ? (
            <section className="state state--ok">
              <Glyph icon={CircleCheck} tone="green" size={64} />
              <div>
                <h2>Attendance marked</h2>
                <p>
                  You were marked present at {fmtTime(mine.at)} {METHOD[mine.method]}.
                </p>
              </div>
            </section>
          ) : phase === 'upcoming' ? (
            <section className="state">
              <Glyph icon={Clock} tone="gold" size={64} />
              <div>
                <h2>Attendance opens at {fmtTime(iso(windowOf(meeting).opensAt))}</h2>
                <p>
                  {meeting.mode === 'offline'
                    ? `The QR scanner and location check open ${OPENS_BEFORE_MIN} minutes before the meeting.`
                    : `You can mark your attendance from ${OPENS_BEFORE_MIN} minutes before the meeting.`}
                </p>
              </div>
            </section>
          ) : phase === 'ended' ? (
            <section className="state state--bad">
              <Glyph icon={CalendarClock} tone="steel" size={64} />
              <div>
                <h2>Attendance not marked</h2>
                <p>This meeting has ended and attendance is closed.</p>
              </div>
            </section>
          ) : meeting.mode === 'online' ? (
            <section className="state state--go">
              <Glyph icon={Video} tone="red" size={64} />
              <div>
                <h2>This meeting is online</h2>
                <p>Mark your attendance once you have joined.</p>
                {onlineError && <div className="form-error">{onlineError}</div>}
              </div>
              <button className="btn btn--primary" onClick={markOnline}>
                <CircleCheck size={17} /> Mark your attendance
              </button>
            </section>
          ) : (
            <>
              {coordinator && (
                <CoordinatorQr
                  meeting={meeting}
                  marked={db.attendance.filter((a) => a.meetingId === meeting.id).length}
                  total={mates.length}
                />
              )}
              <section className="opts" aria-label="Ways to mark attendance">
                {!coordinator && (
                  <article className="opt">
                    <Glyph icon={ScanLine} tone="red" size={56} />
                    <h2>Scan QR code</h2>
                    <p>Scan the code on the attendance coordinator’s screen with your camera.</p>
                    <button
                      className="btn btn--primary"
                      onClick={() => {
                        setScanError('')
                        setScanning(true)
                      }}
                    >
                      <ScanLine size={17} /> Open scanner
                    </button>
                  </article>
                )}
                <GeoCard meeting={meeting} memberId={member.id} />
              </section>
            </>
          )}

          {past.length > 0 && (
            <Sheet icon={CalendarClock} tone="steel" title="Earlier meetings" note="Your attendance record">
              <ListSearch value={q} onChange={setQ} placeholder="Search earlier meetings" />
              {q && shownPast.length === 0 && <NoMatch query={q} />}
              <ul className="hist">
                {shownPast.map((m) => {
                  const rec = db.attendance.find((a) => a.meetingId === m.id && a.memberId === member.id)
                  return (
                    <li key={m.id}>
                      <div>
                        <b>{m.title}</b>
                        <span>
                          {fmtDate(m.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })} · {m.mode === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <span className={`stat ${rec ? 'stat--ok' : 'stat--bad'}`}>{rec ? 'Present' : 'Absent'}</span>
                    </li>
                  )
                })}
              </ul>
            </Sheet>
          )}
        </div>
      )}

      {scanning && <QrScanner key={scanKey} onResult={scanned} onClose={() => setScanning(false)} error={scanError} />}
    </div>
  )
}

function MeetingCard({ meeting, now }: { meeting: Meeting; now: number }) {
  const w = windowOf(meeting)
  const phase = phaseOf(meeting, now)
  return (
    <section className="meet">
      <Glyph icon={meeting.mode === 'online' ? Video : MapPin} tone={meeting.mode === 'online' ? 'navy' : 'red'} size={60} />
      <div className="meet__main">
        <h2>{meeting.title}</h2>
        <p>
          {fmtDate(meeting.startsAt, { weekday: 'long', day: 'numeric', month: 'long' })} · {fmtTime(iso(w.startsAt))} to {fmtTime(iso(w.endsAt))}
        </p>
        {meeting.mode === 'offline' && meeting.venue && (
          <p>
            <MapPin size={14} /> {meeting.venue}
          </p>
        )}
      </div>
      <div className="chips">
        <span className="chip">{meeting.mode === 'online' ? 'Online' : 'Offline'}</span>
        <span className={`stat ${phase === 'open' ? 'stat--ok' : phase === 'upcoming' ? 'stat--idle' : 'stat--bad'}`}>
          {phase === 'open' ? 'Open now' : phase === 'upcoming' ? `Opens ${fmtTime(iso(w.opensAt))}` : 'Ended'}
        </span>
      </div>
    </section>
  )
}

/** Title, date and time of a meeting, shown with the attendance QR code so the room knows which meeting it is for. */
export function MeetingBrief({ meeting }: { meeting: Meeting }) {
  const w = windowOf(meeting)
  return (
    <div className="qrmeet">
      <b>{meeting.title}</b>
      <span>
        {fmtDate(meeting.startsAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {fmtTime(iso(w.startsAt))} to {fmtTime(iso(w.endsAt))}
      </span>
      {meeting.venue && (
        <span>
          <MapPin size={13} /> {meeting.venue}
        </span>
      )}
    </div>
  )
}

/** What the attendance coordinator shows to the room. The code changes every 2 seconds. */
export function CoordinatorQr({ meeting, marked, total, compact, showMeeting }: { meeting: Meeting; marked: number; total: number; compact?: boolean; showMeeting?: boolean }) {
  const now = useNow(200)
  const code = qrCodeFor(meeting.id, now)
  const remainingMs = QR_STEP_MS - (now % QR_STEP_MS)
  const left = Math.ceil(remainingMs / 1000)
  return (
    <section className={`qrpanel ${compact ? 'qrpanel--compact' : ''}`}>
      <div className="qrpanel__code">
        {showMeeting && <MeetingBrief meeting={meeting} />}
        <div className="qrpanel__count">
          <Glyph icon={Users} tone="green" size={40} />
          <div>
            <b>
              {marked} of {total}
            </b>
            <span>members marked present</span>
          </div>
        </div>
        <QrCode text={qrPayload(meeting.id, code)} size={250} />
        <div className="qrpanel__bar" aria-hidden>
          <i style={{ width: `${(remainingMs / QR_STEP_MS) * 100}%`, transition: 'width 0.2s linear' }} />
        </div>
        <small>New code in {left}s</small>
      </div>
    </section>
  )
}

type GeoState = 'idle' | 'locating' | 'ready' | 'denied' | 'unsupported' | 'error'

/** Marks attendance by location. Only turns on inside the radius the admin set for the venue. */
function GeoCard({ meeting, memberId }: { meeting: Meeting; memberId: string }) {
  const toast = useToast()
  const [state, setState] = useState<GeoState>('idle')
  const [pos, setPos] = useState<{ lat: number; lng: number; acc: number } | null>(null)
  const [error, setError] = useState('')
  const watchId = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    }
  }, [])

  function locate() {
    if (!('geolocation' in navigator)) return setState('unsupported')
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    setError('')
    setState('locating')
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) })
        setState('ready')
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
  }

  const distance = pos && meeting.lat != null && meeting.lng != null ? Math.round(distanceM(pos.lat, pos.lng, meeting.lat, meeting.lng)) : null
  const inRange = distance !== null && distance <= meeting.radiusM

  async function mark() {
    if (!pos) return
    const res = await markAttendance(memberId, meeting.id, { method: 'geofence', lat: pos.lat, lng: pos.lng })
    if (res.error) return setError(res.error)
    toast('Attendance marked')
  }

  return (
    <article className={`opt opt--geo ${inRange ? 'is-in' : ''}`}>
      <Glyph icon={LocateFixed} tone={inRange ? 'green' : 'navy'} size={56} />
      <h2>Use my location</h2>
      <p>
        Works only when you are within <b>{meeting.radiusM} m</b> of the venue.
      </p>

      <div className="geo">
        {state === 'idle' && <span className="geo__line">Location is off. Turn it on to check you are at the venue.</span>}
        {state === 'locating' && <span className="geo__line">Finding your location…</span>}
        {state === 'denied' && <span className="geo__line geo__line--bad">Location permission was denied. Allow it in your browser settings and try again.</span>}
        {state === 'unsupported' && <span className="geo__line geo__line--bad">This device cannot share its location.</span>}
        {state === 'error' && <span className="geo__line geo__line--bad">Could not get your location. Check that location is on and try again.</span>}
        {state === 'ready' && distance !== null && (
          <>
            <span className={`geo__dist ${inRange ? 'is-in' : 'is-out'}`}>{distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} m`}</span>
            <span className="geo__line">
              {inRange ? 'You are at the venue.' : `Too far. Get within ${meeting.radiusM} m of the venue.`}
              {pos && <small> Accuracy ± {pos.acc} m</small>}
            </span>
          </>
        )}
      </div>

      {state !== 'ready' && (
        <button className="btn btn--line" onClick={locate} disabled={state === 'locating'}>
          <LocateFixed size={16} /> {state === 'idle' ? 'Check my location' : state === 'locating' ? 'Locating…' : 'Try again'}
        </button>
      )}
      <button className="btn btn--primary" disabled={!inRange} onClick={mark}>
        <CircleCheck size={17} /> Mark your attendance
      </button>
      {error && <div className="form-error">{error}</div>}
    </article>
  )
}
