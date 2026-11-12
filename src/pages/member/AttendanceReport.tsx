import { useState } from 'react'
import { CalendarCheck, Download, UserCheck, UserPlus, Users } from 'lucide-react'
import CpHero from '../../components/CpHero'
import { Avatar, Field } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { fmtDate, fmtTime } from '../../lib/format'
import { useDB } from '../../lib/store'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import { downloadReportPdf } from '../../lib/reportPdf'
import type { Member } from '../../lib/types'

type Tab = 'attendance' | 'substitutes' | 'visitors'
type AttendanceFilter = 'all' | 'present' | 'absent' | 'substitute'

export default function AttendanceReport() {
  const { member, chapter } = useAuth()
  const db = useDB()

  const [tab, setTab] = useState<Tab>('attendance')
  const [q, setQ] = useState('')
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('')
  const [attFilter, setAttFilter] = useState<AttendanceFilter>('all')
  /* an optional date range: with it, the PDF has one column per meeting date; without it, it is the chosen meeting's report */
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')


  if (!member || !chapter) return null

  // Chapter data
  const chapterMembers = db.members.filter((m) => m.chapterId === chapter.id && m.loginEnabled !== false)
  const memberMap = new Map<string, Member>(chapterMembers.map((m) => [m.id, m]))

  const chapterMeetings = [...db.meetings]
    .filter((m) => m.chapterId === chapter.id)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())

  // Default to newest meeting if none selected
  const activeMeetingId = selectedMeetingId || (chapterMeetings[0]?.id ?? '')
  const activeMeeting = chapterMeetings.find((m) => m.id === activeMeetingId)

  // Attendance for active meeting
  const meetingAttendance = db.attendance.filter((a) => a.meetingId === activeMeetingId)
  const meetingSubstitutes = (db.substitutes || []).filter((s) => s.meetingId === activeMeetingId)
  const meetingVisitors = (db.visitors || []).filter((v) => v.meetingId === activeMeetingId)

  const attendedMemberIds = new Set(meetingAttendance.map((a) => a.memberId))

  // Members attendance roll
  /* only the people the meeting is for are on its roll (anyone who still marked attendance stays) */
  const invited = new Set(activeMeeting?.invitedIds ?? [])
  const forThisMeeting = chapterMembers.filter((m) => !invited.size || invited.has(m.id) || attendedMemberIds.has(m.id))
  const roll = forThisMeeting.map((m) => {
    const isPresent = attendedMemberIds.has(m.id)
    const subRecord = meetingSubstitutes.find((s) => s.memberId === m.id)
    const attRecord = meetingAttendance.find((a) => a.memberId === m.id)

    let status: 'present' | 'substitute' | 'absent' = 'absent'
    if (isPresent) status = attRecord?.method === 'substitute' ? 'substitute' : 'present'
    else if (subRecord) status = 'substitute'

    return {
      member: m,
      status,
      attRecord,
      subRecord,
    }
  })

  // Filtered Roll
  const filteredRoll = roll.filter((r) => {
    if (attFilter === 'present' && r.status !== 'present') return false
    if (attFilter === 'absent' && r.status !== 'absent') return false
    if (attFilter === 'substitute' && r.status !== 'substitute') return false
    return true
  })

  const searchedRoll = filteredRoll.filter((r) =>
    matches(q, r.member.name, r.member.organisation, r.member.category, r.subRecord?.substituteName)
  )

  const searchedSubstitutes = meetingSubstitutes.filter((s) => {
    const mem = memberMap.get(s.memberId)
    return matches(q, s.substituteName, s.substituteCompany, s.substitutePhone, mem?.name, mem?.organisation)
  })

  const searchedVisitors = meetingVisitors.filter((v) => {
    const inv = v.invitedById ? memberMap.get(v.invitedById) : undefined
    return matches(q, v.name, v.company, v.category, v.phone, v.email, inv?.name)
  })

  const presentCount = roll.filter((r) => r.status === 'present').length
  const subCount = meetingSubstitutes.length
  const absentCount = roll.filter((r) => r.status === 'absent').length

  const hasRange = !!(from || to)
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA')
  const rangeMeetings = chapterMeetings
    .filter((m) => (!from || dayKey(m.startsAt) >= from) && (!to || dayKey(m.startsAt) <= to))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  function downloadPdf() {
    if (!activeMeeting || !chapter) return

    const meetingInfo = `${activeMeeting.title} · ${fmtDate(activeMeeting.startsAt)} (${activeMeeting.mode.toUpperCase()})`

    if (tab === 'attendance' && hasRange) {
      /* a date range is chosen: one column per meeting date inside it, for every meeting of the chapter */
      const weeks = rangeMeetings
      const weekIds = new Set(weeks.map((m) => m.id))
      const dateTitle = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
      const marked = db.attendance.filter((a) => weekIds.has(a.meetingId))
      const subs = (db.substitutes || []).filter((s) => weekIds.has(s.meetingId))
      const visitors = (db.visitors || []).filter((v) => weekIds.has(v.meetingId))
      const people = chapterMembers.filter((m) => weeks.some((w) => !w.invitedIds?.length || w.invitedIds.includes(m.id)) || marked.some((a) => a.memberId === m.id))
      /* the time they marked attendance, or the substitute who came for them (name and phone); empty when absent */
      const cell = (memberId: string, meetingId: string) => {
        const sub = subs.find((s) => s.meetingId === meetingId && s.memberId === memberId)
        if (sub) return `${sub.substituteName}${sub.substitutePhone ? ` · ${sub.substitutePhone}` : ''}`
        const att = marked.find((a) => a.meetingId === meetingId && a.memberId === memberId)
        return att ? (att.method === 'substitute' ? 'Substitute' : fmtTime(att.at)) : ''
      }
      const first = from ? dateTitle(from) : dateTitle(weeks[0].startsAt)
      const last = to ? dateTitle(to) : dateTitle(weeks[weeks.length - 1].startsAt)
      downloadReportPdf({
        title: 'Weekly Attendance Report',
        subtitle: `${first} to ${last} · ${weeks.length} ${weeks.length === 1 ? 'meeting' : 'meetings'}`,
        chapterName: chapter.name,
        summaryStats: [
          { label: 'Meetings', value: String(weeks.length) },
          { label: 'Members', value: String(people.length) },
          { label: 'Substitutes', value: String(subs.length) },
          { label: 'Visitors', value: String(visitors.length) },
        ],
        columns: [{ title: 'Member Name', width: 150, bold: true }, ...weeks.map((w) => ({ title: dateTitle(w.startsAt), width: 66, bold: false }))],
        rows: people.map((m) => [m.name, ...weeks.map((w) => cell(m.id, w.id))]),
        extraTables:
          visitors.length === 0
            ? []
            : [
                {
                  title: 'Visitors',
                  columns: [
                    { title: 'Date', width: 80, bold: false },
                    { title: 'Visitor Name', width: 160, bold: true },
                    { title: 'Phone', width: 110, bold: false },
                    { title: 'Invited By', width: 150, bold: false },
                  ],
                  rows: visitors
                    .map((v) => ({ v, at: weeks.find((w) => w.id === v.meetingId)?.startsAt ?? '' }))
                    .sort((a, b) => a.at.localeCompare(b.at))
                    .map(({ v, at }) => [dateTitle(at), v.name, v.phone, (v.invitedById && memberMap.get(v.invitedById)?.name) || 'Walk-in']),
                },
              ],
        filename: `weekly-attendance-report-${first}-to-${last}`,
      })
    } else if (tab === 'attendance') {
      downloadReportPdf({
        title: 'Meeting Attendance Report',
        subtitle: meetingInfo,
        chapterName: chapter.name,
        summaryStats: [
          { label: 'Present', value: String(presentCount) },
          { label: 'Substitutes', value: String(subCount) },
          { label: 'Absent', value: String(absentCount) },
          { label: 'Total Members', value: String(roll.length) },
        ],
        columns: [
          { title: 'Member Name', width: 140 },
          { title: 'Company / Business', width: 130 },
          { title: 'Status', width: 75 },
          { title: 'Method', width: 65 },
          { title: 'Time', width: 60 },
          { title: 'Substitute Details', width: 130 },
        ],
        rows: filteredRoll.map((r) => [
          r.member.name,
          `${r.member.organisation || '-'}${r.member.category ? ` (${r.member.category})` : ''}`,
          r.status.toUpperCase(),
          r.attRecord ? r.attRecord.method.toUpperCase() : '-',
          r.attRecord ? fmtTime(r.attRecord.at) : '-',
          r.subRecord ? `${r.subRecord.substituteName}${r.subRecord.substitutePhone ? ` · ${r.subRecord.substitutePhone}` : ''}` : '-',
        ]),
        extraTables:
          meetingVisitors.length === 0
            ? []
            : [
                {
                  title: 'Visitors',
                  columns: [
                    { title: 'Visitor Name', width: 170, bold: true },
                    { title: 'Phone', width: 120, bold: false },
                    { title: 'Invited By', width: 170, bold: false },
                  ],
                  rows: meetingVisitors.map((v) => [v.name, v.phone, (v.invitedById && memberMap.get(v.invitedById)?.name) || 'Walk-in']),
                },
              ],
        filename: `attendance-report-${activeMeeting.title.toLowerCase().replace(/\s+/g, '-')}`,
      })
    } else if (tab === 'substitutes') {
      downloadReportPdf({
        title: 'Meeting Substitutes Report',
        subtitle: meetingInfo,
        chapterName: chapter.name,
        summaryStats: [
          { label: 'Total Substitutes', value: String(meetingSubstitutes.length) },
          { label: 'Meeting Date', value: fmtDate(activeMeeting.startsAt) },
        ],
        columns: [
          { title: 'Substitute Name', width: 130 },
          { title: 'Company', width: 120 },
          { title: 'Contact', width: 100 },
          { title: 'Representing Member', width: 150 },
        ],
        rows: meetingSubstitutes.map((s) => {
          const mem = memberMap.get(s.memberId)
          return [
            s.substituteName,
            s.substituteCompany || '-',
            `${s.substitutePhone || '-'}${s.substituteEmail ? ` / ${s.substituteEmail}` : ''}`,
            `${mem?.name || 'Member'}${mem?.organisation ? ` (${mem.organisation})` : ''}`,
          ]
        }),
        filename: `substitutes-report-${activeMeeting.title.toLowerCase().replace(/\s+/g, '-')}`,
      })
    } else {
      downloadReportPdf({
        title: 'Meeting Visitors Registry',
        subtitle: meetingInfo,
        chapterName: chapter.name,
        summaryStats: [
          { label: 'Total Visitors', value: String(meetingVisitors.length) },
          { label: 'Meeting Date', value: fmtDate(activeMeeting.startsAt) },
        ],
        columns: [
          { title: 'Visitor Name', width: 120 },
          { title: 'Company / Firm', width: 120 },
          { title: 'Category', width: 90 },
          { title: 'Contact Details', width: 100 },
          { title: 'Invited By', width: 120 },
        ],
        rows: meetingVisitors.map((v) => {
          const inv = v.invitedById ? memberMap.get(v.invitedById) : undefined
          return [
            v.name,
            v.company,
            v.category || '-',
            `${v.phone}${v.email ? ` / ${v.email}` : ''}`,
            inv?.name || 'Walk-in',
          ]
        }),
        filename: `visitors-registry-${activeMeeting.title.toLowerCase().replace(/\s+/g, '-')}`,
      })
    }
  }

  const turnout = roll.length ? Math.round(((presentCount + subCount) / roll.length) * 100) : 0
  const RING = 2 * Math.PI * 40

  return (
    <div className="page ar">
      <CpHero className="ar-hero" icon={CalendarCheck} eyebrow={`${chapter.name} · ${member.designation}`} title="Attendance & Visitors Report" sub="Meeting attendance, substitutes and the visitor registry." back={{ to: '/reports', label: 'Reports' }}>
        <span className="rp-ring" role="img" aria-label={`${turnout} percent turnout`}>
          <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden>
            <circle cx="46" cy="46" r="40" fill="none" strokeWidth="7" className="rp-ring__bg" />
            <circle cx="46" cy="46" r="40" fill="none" strokeWidth="7" strokeLinecap="round" className="rp-ring__fg" strokeDasharray={RING} strokeDashoffset={RING * (1 - turnout / 100)} transform="rotate(-90 46 46)" />
          </svg>
          <span>
            <b>{turnout}%</b>
            <small>turnout</small>
          </span>
        </span>
      </CpHero>

      {chapterMeetings.length === 0 ? (
        <div className="cp-empty">
          <CalendarCheck size={30} />
          <b>No meetings found</b>
          <span>Schedule meetings in Chapter Controls &gt; Meetings to track attendance and visitors.</span>
        </div>
      ) : (
        <>
          {/* which meeting, and an optional date range for the date-wise PDF */}
          <div className="ar-pick">
            <Field label="Select meeting">
              <select className="field__control native-select" value={activeMeetingId} onChange={(e) => setSelectedMeetingId(e.target.value)}>
                {chapterMeetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} · {fmtDate(m.startsAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} ({m.mode.toUpperCase()})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From date">
              <input className="field__control" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To date">
              <input className="field__control" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </Field>
            {hasRange && (
              <button
                type="button"
                className="cp-act cr-clear"
                onClick={() => {
                  setFrom('')
                  setTo('')
                }}
              >
                Clear dates
              </button>
            )}
          </div>
          <p className="au-hint">
            {hasRange
              ? rangeMeetings.length === 0
                ? 'No meetings in this date range.'
                : `Member attendance PDF: one column per meeting date, ${rangeMeetings.length} ${rangeMeetings.length === 1 ? 'meeting' : 'meetings'} in this range.`
              : "Choose dates to download a date-wise attendance PDF. Leave them empty for the selected meeting's report."}
          </p>

          <div className="cp-tabs ar-tabs" role="tablist">
            {(
              [
                ['attendance', 'Member attendance', roll.length],
                ['substitutes', 'Substitutes', meetingSubstitutes.length],
                ['visitors', 'Visitors', meetingVisitors.length],
              ] as const
            ).map(([id, label, n]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} aria-pressed={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
                {label}
                <i>{n}</i>
              </button>
            ))}
          </div>

          {/* Tab 1: the roll, as a wall of people */}
          {tab === 'attendance' && (
            <>
              <div className="ar-counts">
                {(
                  [
                    ['all', 'All', roll.length, 'idle'],
                    ['present', 'Present', presentCount, 'ok'],
                    ['substitute', 'Substitute', subCount, 'warn'],
                    ['absent', 'Absent', absentCount, 'bad'],
                  ] as const
                ).map(([id, label, n, cls]) => (
                  <button key={id} type="button" className={`ar-count ar-count--${cls}${attFilter === id ? ' is-on' : ''}`} aria-pressed={attFilter === id} onClick={() => setAttFilter(id)}>
                    <b>{n}</b>
                    <small>{label}</small>
                  </button>
                ))}
                <button type="button" className="cp-act ar-pdf" onClick={downloadPdf} disabled={hasRange ? rangeMeetings.length === 0 : searchedRoll.length === 0}>
                  <Download size={15} /> Download PDF
                </button>
              </div>

              <ListSearch value={q} onChange={setQ} placeholder="Search member name, company, or substitute..." />
              {q && searchedRoll.length === 0 && filteredRoll.length > 0 && <NoMatch query={q} />}

              <ul className="ar-wall">
                {searchedRoll.map((r) => (
                  <li key={r.member.id} className={`ar-tile ar-tile--${r.status}`}>
                    <span className="ar-tile__photo">
                      <Avatar name={r.member.name} photo={r.member.photo} size={52} />
                    </span>
                    <div className="ar-tile__txt">
                      <b>{r.member.name}</b>
                      <span>
                        {r.member.organisation} {r.member.category ? `· ${r.member.category}` : ''}
                      </span>
                      {r.status === 'present' && r.attRecord && (
                        <small>
                          Marked at {fmtTime(r.attRecord.at)} via {r.attRecord.method.toUpperCase()}
                          {r.attRecord.distanceM !== undefined ? ` · ${Math.round(r.attRecord.distanceM)}m away` : ''}
                        </small>
                      )}
                      {r.status === 'substitute' && r.subRecord && (
                        <small>
                          Represented by <b>{r.subRecord.substituteName}</b>
                          {r.subRecord.substitutePhone ? ` · ${r.subRecord.substitutePhone}` : ''}
                        </small>
                      )}
                    </div>
                    <span className={`ar-tile__st ar-tile__st--${r.status}`}>{r.status === 'present' ? 'Present' : r.status === 'substitute' ? 'Substitute' : 'Absent'}</span>
                  </li>
                ))}
              </ul>

              <h2 className="ar-h">
                <UserPlus size={17} /> Visitors <span>{meetingVisitors.length}</span>
              </h2>
              {meetingVisitors.length === 0 ? (
                <div className="cp-empty cp-empty--soft">
                  <b>No visitors registered for this meeting</b>
                </div>
              ) : (
                <ul className="ar-people">
                  {meetingVisitors.map((v) => {
                    const inv = v.invitedById ? memberMap.get(v.invitedById) : undefined
                    return (
                      <li key={v.id} className="ar-person ar-person--visitor">
                        <span className="ar-person__ico">
                          <UserPlus size={18} />
                        </span>
                        <div>
                          <b>{v.name}</b>
                          <span>{v.phone}</span>
                          {inv && (
                            <small>
                              Invited by <b>{inv.name}</b>
                            </small>
                          )}
                        </div>
                        <em>Visitor</em>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}

          {/* Tab 2: Substitutes */}
          {tab === 'substitutes' && (
            <>
              <div className="cr-listbar">
                <h2>
                  Substitutes attending <span>{meetingSubstitutes.length}</span>
                </h2>
                <button type="button" className="cp-act" onClick={downloadPdf} disabled={searchedSubstitutes.length === 0}>
                  <Download size={15} /> Download PDF
                </button>
              </div>
              <ListSearch value={q} onChange={setQ} placeholder="Search substitute name, phone, or represented member..." />
              {q && searchedSubstitutes.length === 0 && meetingSubstitutes.length > 0 && <NoMatch query={q} />}
              {meetingSubstitutes.length === 0 ? (
                <div className="cp-empty">
                  <Users size={30} />
                  <b>No substitutes entered for this meeting</b>
                  <span>Substitutes attending on behalf of a member appear here.</span>
                </div>
              ) : (
                <ul className="ar-people">
                  {searchedSubstitutes.map((s) => {
                    const mem = memberMap.get(s.memberId)
                    return (
                      <li key={s.id} className="ar-person ar-person--sub">
                        <span className="ar-person__ico">
                          <Users size={18} />
                        </span>
                        <div>
                          <b>{s.substituteName}</b>
                          <span>{s.substitutePhone || 'No phone number'}</span>
                          <small>
                            Attending for <b>{mem?.name}</b> {mem?.organisation ? `(${mem.organisation})` : ''}
                          </small>
                          {s.notes && <small>Note: {s.notes}</small>}
                        </div>
                        <em>Substitute</em>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}

          {/* Tab 3: Visitors */}
          {tab === 'visitors' && (
            <>
              <div className="cr-listbar">
                <h2>
                  Registered visitors <span>{meetingVisitors.length}</span>
                </h2>
                <button type="button" className="cp-act" onClick={downloadPdf} disabled={searchedVisitors.length === 0}>
                  <Download size={15} /> Download PDF
                </button>
              </div>
              <ListSearch value={q} onChange={setQ} placeholder="Search visitor name, company, category, phone..." />
              {q && searchedVisitors.length === 0 && meetingVisitors.length > 0 && <NoMatch query={q} />}
              {meetingVisitors.length === 0 ? (
                <div className="cp-empty">
                  <UserCheck size={30} />
                  <b>No visitors registered for this meeting</b>
                  <span>Visitors registered for this chapter meeting appear here.</span>
                </div>
              ) : (
                <ul className="ar-people">
                  {searchedVisitors.map((v) => {
                    const inv = v.invitedById ? memberMap.get(v.invitedById) : undefined
                    return (
                      <li key={v.id} className="ar-person ar-person--visitor">
                        <span className="ar-person__ico">
                          <UserPlus size={18} />
                        </span>
                        <div>
                          <b>{v.name}</b>
                          <span>{v.phone}</span>
                          {inv && (
                            <small>
                              Invited by <b>{inv.name}</b>
                            </small>
                          )}
                          {v.notes && <small>Note: {v.notes}</small>}
                        </div>
                        <em>Visitor</em>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
