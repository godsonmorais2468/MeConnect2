import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarClock, CalendarPlus, Clock, LocateFixed, MapPin, Plus, Trash2, UserCheck, Users, Video, X } from 'lucide-react'
import AudiencePicker from '../../components/AudiencePicker'
import CpHero from '../../components/CpHero'
import ManualAttendance from '../../components/ManualAttendance'
import type { AudienceChoice } from '../../components/AudiencePicker'
import { Field, FieldGroup } from '../../components/ui'
import { phaseOf } from '../../lib/attendance'
import { useAuth } from '../../lib/auth'
import { designationOptions, isHeadTable } from '../../lib/designations'
import { fmtDate, fmtTime } from '../../lib/format'
import { useNow } from '../../lib/hooks'
import { createMeeting, deleteMeeting, useDB } from '../../lib/store'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { nearbyPlaces } from '../../lib/googleMaps'
import VenueSearch from '../../components/VenueSearch'
import { matches } from '../../lib/search'
import type { MeetingMode } from '../../lib/types'

const inRange = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi

/** Meetings: an agenda. The composer folds open on top, the meetings run down a timeline of dates. */
export default function Meetings() {
  const { region, chapter: myChapter } = useAuth()
  const db = useDB()
  const [q, setQ] = useState('')
  const toast = useToast()
  const confirm = useConfirm()
  const now = useNow(30_000)

  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<MeetingMode>('offline')
  const [when, setWhen] = useState({ date: '', time: '' })
  const [duration, setDuration] = useState('')
  const [venue, setVenue] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radius, setRadius] = useState('')
  const [audience, setAudience] = useState<AudienceChoice>({ audience: 'all', designations: [], memberIds: [] })
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  /* set the instant Save is pressed, so a quick second press cannot start another save before the screen has updated */
  const savingNow = useRef(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  /* the meeting whose Manual Attendance list is open */
  const [manualFor, setManualFor] = useState<string | null>(null)
  /* the composer: open when there are no meetings yet, and shut after that until "New meeting" is pressed */
  const [composeOpt, setComposeOpt] = useState<boolean | null>(null)
  const [tab, setTab] = useState<'all' | 'live' | 'ended'>('all')

  if (!region || !myChapter) return null
  const meetings = db.meetings
    .filter((m) => m.chapterId === myChapter.id)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
  const manualMeeting = manualFor ? meetings.find((m) => m.id === manualFor) : undefined

  /* the people of this chapter a meeting can be for: those who can sign in to it */
  const roster = db.members.filter((m) => m.chapterId === myChapter.id && m.loginEnabled !== false && m.isActive !== false)
  const invitedNow = roster.filter(
    (m) =>
      audience.audience === 'all' ||
      isHeadTable(db, m) ||
      (audience.audience === 'designations' ? audience.designations.includes(m.designation) : audience.memberIds.includes(m.id)),
  ).length

  /** Names the place at these coordinates: the closest named place fills an empty venue. */
  async function fillVenueFrom(latitude: number, longitude: number) {
    const found = await nearbyPlaces(latitude, longitude)
    if (found.length > 0) {
      /* only an empty venue is filled: a name the person already typed stays */
      setVenue((current) => (current.trim() ? current : found[0]))
      setErrors((e) => (venue.trim() ? e : { ...e, venue: '' }))
    }
  }

  function fillFromGps() {
    if (!('geolocation' in navigator)) return setErrors((e) => ({ ...e, lat: 'This browser cannot share its location.' }))
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6))
        setLng(p.coords.longitude.toFixed(6))
        setLocating(false)
        setErrors((e) => ({ ...e, lat: '', lng: '' }))
        void fillVenueFrom(p.coords.latitude, p.coords.longitude)
      },
      () => {
        setLocating(false)
        setErrors((e) => ({ ...e, lat: 'Could not get your location. Type the coordinates instead.' }))
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  /** Back to an empty form, ready for the next meeting. */
  function resetForm() {
    setTitle('')
    setMode('offline')
    setWhen({ date: '', time: '' })
    setDuration('')
    setVenue('')
    setLat('')
    setLng('')
    setRadius('')
    setAudience({ audience: 'all', designations: [], memberIds: [] })
    setErrors({})
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!region || !myChapter || savingNow.current) return
    const next: Record<string, string> = {}
    const mins = Number(duration)
    if (!title.trim()) next.title = 'Enter a meeting title.'
    if (!when.date || !when.time) next.when = 'Pick the date and start time.'
    if (!inRange(mins, 15, 600)) next.duration = 'Enter a duration between 15 and 600 minutes.'
    if (audience.audience === 'designations' && audience.designations.length === 0) next.audience = 'Choose at least one designation.'
    if (audience.audience === 'members' && audience.memberIds.length === 0) next.audience = 'Choose at least one member.'
    if (mode === 'offline') {
      if (!venue.trim()) next.venue = 'Enter the venue name.'
      if (!inRange(Number(lat), -90, 90) || !lat.trim()) next.lat = 'Enter a latitude between -90 and 90.'
      if (!inRange(Number(lng), -180, 180) || !lng.trim()) next.lng = 'Enter a longitude between -180 and 180.'
      if (!inRange(Number(radius), 10, 5000)) next.radius = 'Enter a radius between 10 and 5000 metres.'
    }
    const startsAt = new Date(`${when.date}T${when.time}`).toISOString()
    /* the same meeting twice (a second press of Save) is refused */
    if (!next.when && meetings.some((m) => m.title.trim().toLowerCase() === title.trim().toLowerCase() && new Date(m.startsAt).getTime() === new Date(startsAt).getTime())) next.form = 'This meeting is already saved for that date and time.'
    setErrors(next)
    if (Object.keys(next).length) return

    savingNow.current = true
    setSaving(true)
    const res = await createMeeting({
      regionId: region.id,
      chapterId: myChapter.id,
      title,
      mode,
      startsAt,
      durationMin: mins,
      venue: mode === 'offline' ? venue : '',
      lat: mode === 'offline' ? Number(lat) : null,
      lng: mode === 'offline' ? Number(lng) : null,
      radiusM: mode === 'offline' ? Number(radius) : 100,
      audience: audience.audience,
      audienceDesignations: audience.audience === 'designations' ? audience.designations : [],
      inviteeIds: audience.audience === 'members' ? audience.memberIds : [],
    })
    savingNow.current = false
    setSaving(false)
    if (res.error) return setErrors({ [res.field ?? 'form']: res.error })
    toast('Meeting created')
    resetForm()
    setComposeOpt(false)
  }

  const upcoming = meetings.filter((m) => phaseOf(m, now) !== 'ended').length
  const compose = composeOpt ?? meetings.length === 0
  const found = meetings.filter((m) => matches(q, m.title, m.venue, m.mode, fmtDate(m.startsAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })))
  const shown = found.filter((m) => tab === 'all' || (tab === 'live') === (phaseOf(m, now) !== 'ended'))
  const marksTotal = db.attendance.filter((a) => meetings.some((m) => m.id === a.meetingId)).length

  return (
    <div className="page mt">
      <CpHero className="mt-hero" icon={CalendarClock} eyebrow={`${myChapter.name} · Head Table`} title="Meetings" sub="Schedule chapter meetings. For offline meetings, set the venue and how close members must be to mark attendance.">
        <div className="mt-hero__side">
          <div className="mt-hero__nums">
            <span>
              <b>{meetings.length}</b>
              <small>meetings</small>
            </span>
            <span>
              <b>{upcoming}</b>
              <small>open / upcoming</small>
            </span>
            <span>
              <b>{marksTotal}</b>
              <small>marked</small>
            </span>
          </div>
          <button type="button" className={`mt-new${compose ? ' is-open' : ''}`} onClick={() => setComposeOpt(!compose)} aria-expanded={compose} aria-controls="mt-composer">
            {compose ? <X size={17} /> : <Plus size={17} />} {compose ? 'Close' : 'New meeting'}
          </button>
        </div>
      </CpHero>

      <section className="mt-composer" id="mt-composer" data-open={compose} inert={!compose} aria-label="Create meeting">
        <div className="mt-composer__in">
          <form className="mt-form" onSubmit={submit} noValidate>
            <div className="mt-col">
              <h2 className="mt-h">
                <CalendarPlus size={17} /> The meeting
              </h2>
              <Field label="Meeting title" required error={errors.title}>
                <input className="field__control" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly meeting" />
              </Field>

              <FieldGroup label="Meeting type" required>
                <div className="seg" role="group">
                  <button type="button" aria-pressed={mode === 'offline'} onClick={() => setMode('offline')}>
                    Offline
                  </button>
                  <button type="button" aria-pressed={mode === 'online'} onClick={() => setMode('online')}>
                    Online
                  </button>
                </div>
              </FieldGroup>

              <div className="form-grid form-grid--pair">
                <Field label="Date" required error={errors.when}>
                  <input className="field__control" type="date" value={when.date} onChange={(e) => setWhen((w) => ({ ...w, date: e.target.value }))} />
                </Field>
                <Field label="Start time" required>
                  <input className="field__control" type="time" value={when.time} onChange={(e) => setWhen((w) => ({ ...w, time: e.target.value }))} />
                </Field>
              </div>
              <Field label="Duration (minutes)" required hint="Attendance stays open until the meeting ends." error={errors.duration}>
                <input className="field__control" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 90" />
              </Field>
            </div>

            <div className="mt-col">
              <h2 className="mt-h">
                <Users size={17} /> Who and where
              </h2>
              <AudiencePicker value={audience} onChange={setAudience} members={roster} designations={designationOptions(db, region.id, '', myChapter.id)} invited={invitedNow} error={errors.audience} />

              {mode === 'offline' && (
                <>
                  <Field label="Venue" required error={errors.venue}>
                    <VenueSearch
                      value={venue}
                      onChange={setVenue}
                      onPick={(place) => {
                        /* choosing a suggestion fills the venue and its coordinates */
                        setVenue(place.text)
                        setLat(place.lat.toFixed(6))
                        setLng(place.lng.toFixed(6))
                        setErrors((e) => ({ ...e, venue: '', lat: '', lng: '' }))
                      }}
                      placeholder="Hotel or hall name, city"
                    />
                  </Field>
                  <div className="form-grid form-grid--pair">
                    <Field label="Latitude" required error={errors.lat}>
                      <input className="field__control" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="8.488890" />
                    </Field>
                    <Field label="Longitude" required error={errors.lng}>
                      <input className="field__control" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="76.951010" />
                    </Field>
                  </div>
                  <div>
                    <button type="button" className="btn btn--line btn--sm" onClick={fillFromGps} disabled={locating}>
                      <LocateFixed size={15} /> {locating ? 'Locating…' : 'Use my current location'}
                    </button>
                  </div>
                  <Field label="Geofence radius (metres)" required hint="Members can mark attendance by location only within this distance of the venue." error={errors.radius}>
                    <input className="field__control" inputMode="numeric" value={radius} onChange={(e) => setRadius(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 100" />
                  </Field>
                </>
              )}
            </div>

            <div className="mt-form__foot">
              {errors.form && <div className="form-error">{errors.form}</div>}
              <button className="mt-btn" type="submit" disabled={saving}>
                <CalendarPlus size={16} /> Save meeting
              </button>
            </div>
          </form>
        </div>
      </section>

      <div className="mt-bar">
        <div className="mt-tabs" role="tablist" aria-label="Show meetings">
          {(
            [
              ['all', 'All', meetings.length],
              ['live', 'Open / upcoming', upcoming],
              ['ended', 'Ended', meetings.length - upcoming],
            ] as const
          ).map(([id, label, n]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
              {label}
              <i>{n}</i>
            </button>
          ))}
        </div>
        <ListSearch value={q} onChange={setQ} placeholder="Search meetings" />
      </div>
      {q && found.length === 0 && meetings.length > 0 && <NoMatch query={q} />}

      {meetings.length === 0 ? (
        <div className="mt-empty">
          <CalendarClock size={30} />
          <b>No meetings yet</b>
          <span>Create the first one to open attendance for your chapter.</span>
        </div>
      ) : (
        <>
          {shown.length === 0 && !q && (
            <div className="mt-empty mt-empty--soft">
              <b>Nothing here</b>
              <span>No meetings in this view.</span>
            </div>
          )}
          <ol className="mt-line">
            {shown.map((m) => {
              const chapter = db.chapters.find((c) => c.id === m.chapterId)
              const phase = phaseOf(m, now)
              const marked = db.attendance.filter((a) => a.meetingId === m.id).length
              const total = m.invitedIds?.length ?? 0
              const pct = total ? Math.min(100, Math.round((marked / total) * 100)) : 0
              const audienceLabel =
                m.audience === 'designations'
                  ? m.audienceDesignations.length === 1
                    ? m.audienceDesignations[0]
                    : `${m.audienceDesignations.length} designations`
                  : m.audience === 'members'
                    ? `${m.inviteeIds.length} ${m.inviteeIds.length === 1 ? 'member' : 'members'}`
                    : 'All members'
              const online = m.mode === 'online'
              return (
                <li key={m.id} className={`mt-item mt-item--${phase}`}>
                  <div className="mt-date" aria-hidden>
                    <small>{fmtDate(m.startsAt, { month: 'short' })}</small>
                    <b>{fmtDate(m.startsAt, { day: 'numeric' })}</b>
                    <i>{fmtDate(m.startsAt, { weekday: 'short' })}</i>
                  </div>
                  <article className="mt-card">
                    <header className="mt-card__head">
                      <span className="mt-mode">
                        {online ? <Video size={14} /> : <MapPin size={14} />} {online ? 'Online' : 'Offline'}
                      </span>
                      <span className={`mt-phase mt-phase--${phase}`}>{phase === 'open' ? 'Open now' : phase === 'upcoming' ? 'Upcoming' : 'Ended'}</span>
                      <button
                        className="mt-del"
                        aria-label={`Delete ${m.title}`}
                        onClick={async () => {
                          if (!(await confirm({ title: 'Delete meeting?', message: `"${m.title}" and its attendance will be removed.` }))) return
                          deleteMeeting(m.id)
                          toast('Meeting deleted')
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </header>
                    <h3>
                      {m.title} <span>· {chapter?.name ?? 'Chapter'}</span>
                    </h3>
                    <p className="mt-when">
                      <Clock size={14} /> {fmtTime(m.startsAt)} · {m.durationMin} min
                      {!online && (
                        <>
                          <i /> <MapPin size={14} /> {m.venue} · {m.radiusM} m geofence
                        </>
                      )}
                    </p>
                    <div className="mt-prog" role="img" aria-label={`${marked} of ${total} present`}>
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    <footer className="mt-card__foot">
                      <span className="mt-chip">
                        <Users size={13} /> {audienceLabel}
                      </span>
                      <span className="mt-chip mt-chip--acc">
                        {marked}/{total} present
                      </span>
                      <button
                        type="button"
                        className="mt-manual"
                        disabled={phase === 'upcoming'}
                        title={phase === 'upcoming' ? 'Available once the meeting starts' : 'Mark members who have no attendance'}
                        onClick={() => setManualFor(m.id)}
                      >
                        <UserCheck size={14} /> Manual Attendance
                      </button>
                    </footer>
                  </article>
                </li>
              )
            })}
          </ol>
        </>
      )}

      {manualMeeting && <ManualAttendance meeting={manualMeeting} onClose={() => setManualFor(null)} />}
    </div>
  )
}
