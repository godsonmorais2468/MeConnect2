import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  Download,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { Avatar, Field, PageHead, StatStrip } from '../../components/ui'
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
  const visitorCount = meetingVisitors.length

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

  return (
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={CalendarCheck}
        tone="green"
        title="Attendance & Visitors Report"
        subtitle="Chapter meeting attendance records, substitute details, and visitor registry logs."
        actions={
          <Link className="btn btn--line btn--sm" to="/reports">
            <ArrowLeft size={16} /> Reports
          </Link>
        }
      />

      <StatStrip
        items={[
          { label: 'Present', value: presentCount, icon: UserCheck, tone: 'green' },
          { label: 'Substitutes', value: subCount, icon: Users, tone: 'gold' },
          { label: 'Absent', value: absentCount, icon: CalendarClock, tone: 'red' },
          { label: 'Visitors', value: visitorCount, icon: UserPlus, tone: 'navy' },
        ]}
      />

      {chapterMeetings.length === 0 ? (
        <div className="empty">
          <b>No meetings found.</b>
          Schedule meetings in Chapter Controls &gt; Meetings to track attendance and visitors.
        </div>
      ) : (
        <div className="att">
          {/* Meeting selector bar */}
          <div className="filterbar" style={{ marginBottom: 16 }}>
            <Field label="Select Meeting">
              <select
                className="field__control native-select"
                value={activeMeetingId}
                onChange={(e) => setSelectedMeetingId(e.target.value)}
              >
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
              <button type="button" className="btn btn--line btn--sm" onClick={() => { setFrom(''); setTo('') }}>
                Clear dates
              </button>
            )}
          </div>
          <p className="field__hint" style={{ margin: '-8px 0 16px' }}>
            {hasRange
              ? rangeMeetings.length === 0
                ? 'No meetings in this date range.'
                : `Member attendance PDF: one column per meeting date, ${rangeMeetings.length} ${rangeMeetings.length === 1 ? 'meeting' : 'meetings'} in this range.`
              : 'Choose dates to download a date-wise attendance PDF. Leave them empty for the selected meeting\'s report.'}
          </p>

          {/* Sub Navigation Tabs */}
          <div className="seg dues__tabs" role="tablist" style={{ marginBottom: 16 }}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'attendance'}
              aria-pressed={tab === 'attendance'}
              onClick={() => setTab('attendance')}
            >
              Member Attendance ({roll.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'substitutes'}
              aria-pressed={tab === 'substitutes'}
              onClick={() => setTab('substitutes')}
            >
              Substitutes ({meetingSubstitutes.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'visitors'}
              aria-pressed={tab === 'visitors'}
              onClick={() => setTab('visitors')}
            >
              Visitors ({meetingVisitors.length})
            </button>
          </div>

          {/* Tab 1: Member Attendance */}
          {tab === 'attendance' && (
            <div className="list">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div className="filterbar" style={{ margin: 0 }}>
                  <select
                    className="field__control native-select"
                    style={{ minWidth: 180, height: 40 }}
                    value={attFilter}
                    onChange={(e) => setAttFilter(e.target.value as AttendanceFilter)}
                  >
                    <option value="all">All Members ({roll.length})</option>
                    <option value="present">Present ({presentCount})</option>
                    <option value="substitute">Substitute ({subCount})</option>
                    <option value="absent">Absent ({absentCount})</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn--line btn--sm"
                  onClick={downloadPdf}
                  disabled={hasRange ? rangeMeetings.length === 0 : searchedRoll.length === 0}
                >
                  <Download size={15} /> Download PDF
                </button>
              </div>

              <ListSearch value={q} onChange={setQ} placeholder="Search member name, company, or substitute..." />

              {q && searchedRoll.length === 0 && filteredRoll.length > 0 && <NoMatch query={q} />}

              <ul className="plist">
                {searchedRoll.map((r) => (
                  <li key={r.member.id} className="prow">
                    <Avatar name={r.member.name} photo={r.member.photo} size={44} />
                    <div className="prow__main">
                      <b>{r.member.name}</b>
                      <span>
                        {r.member.organisation} {r.member.category ? `· ${r.member.category}` : ''}
                      </span>
                      {r.status === 'present' && r.attRecord && (
                        <span className="prow__meta">
                          Marked at {fmtTime(r.attRecord.at)} via {r.attRecord.method.toUpperCase()}
                          {r.attRecord.distanceM !== undefined ? ` · ${Math.round(r.attRecord.distanceM)}m away` : ''}
                        </span>
                      )}
                      {r.status === 'substitute' && r.subRecord && (
                        <span className="prow__meta" style={{ color: 'var(--gold-ink)' }}>
                          Represented by Substitute: <b>{r.subRecord.substituteName}</b>
                          {r.subRecord.substitutePhone ? ` · ${r.subRecord.substitutePhone}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="prow__side">
                      {r.status === 'present' && <span className="stat stat--ok">Present</span>}
                      {r.status === 'substitute' && <span className="stat stat--gold">Substitute</span>}
                      {r.status === 'absent' && <span className="stat stat--bad">Absent</span>}
                    </div>
                  </li>
                ))}
              </ul>

              <h2 className="list__title" style={{ marginTop: 18 }}>
                Visitors <span>{meetingVisitors.length}</span>
              </h2>
              {meetingVisitors.length === 0 ? (
                <div className="empty">
                  <b>No visitors registered for this meeting.</b>
                </div>
              ) : (
                <ul className="plist">
                  {meetingVisitors.map((v) => {
                    const inv = v.invitedById ? memberMap.get(v.invitedById) : undefined
                    return (
                      <li key={v.id} className="prow">
                        <div className="glyph t-navy" style={{ '--size': '44px' } as CSSProperties}>
                          <UserPlus size={20} />
                        </div>
                        <div className="prow__main">
                          <b>{v.name}</b>
                          <span>{v.phone}</span>
                          {inv && (
                            <span className="prow__meta" style={{ color: 'var(--ink)' }}>
                              Invited by: <b>{inv.name}</b>
                            </span>
                          )}
                        </div>
                        <div className="prow__side">
                          <span className="stat stat--ok">Visitor</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Tab 2: Substitutes */}
          {tab === 'substitutes' && (
            <div className="list">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <h2 className="list__title" style={{ margin: 0 }}>
                  Substitutes Attending <span>{meetingSubstitutes.length}</span>
                </h2>
                <button
                  type="button"
                  className="btn btn--line btn--sm"
                  onClick={downloadPdf}
                  disabled={searchedSubstitutes.length === 0}
                >
                  <Download size={15} /> Download PDF
                </button>
              </div>

              <ListSearch value={q} onChange={setQ} placeholder="Search substitute name, phone, or represented member..." />

              {q && searchedSubstitutes.length === 0 && meetingSubstitutes.length > 0 && <NoMatch query={q} />}

              {meetingSubstitutes.length === 0 ? (
                <div className="empty">
                  <b>No substitutes entered for this meeting.</b>
                  Substitutes attending on behalf of a member appear here.
                </div>
              ) : (
                <ul className="plist">
                  {searchedSubstitutes.map((s) => {
                    const mem = memberMap.get(s.memberId)
                    return (
                      <li key={s.id} className="prow">
                        <div className="glyph t-gold" style={{ '--size': '44px' } as any}>
                          <Users size={20} />
                        </div>
                        <div className="prow__main">
                          <b>{s.substituteName}</b>
                          <span>{s.substitutePhone || 'No phone number'}</span>
                          <span className="prow__meta">
                            Attending for: <b>{mem?.name}</b> {mem?.organisation ? `(${mem.organisation})` : ''}
                          </span>
                          {s.notes && <span className="prow__meta">Note: {s.notes}</span>}
                        </div>
                        <div className="prow__side" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <span className="stat stat--gold">Substitute</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Tab 3: Visitors */}
          {tab === 'visitors' && (
            <div className="list">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <h2 className="list__title" style={{ margin: 0 }}>
                  Registered Visitors <span>{meetingVisitors.length}</span>
                </h2>
                <button
                  type="button"
                  className="btn btn--line btn--sm"
                  onClick={downloadPdf}
                  disabled={searchedVisitors.length === 0}
                >
                  <Download size={15} /> Download PDF
                </button>
              </div>

              <ListSearch value={q} onChange={setQ} placeholder="Search visitor name, company, category, phone..." />

              {q && searchedVisitors.length === 0 && meetingVisitors.length > 0 && <NoMatch query={q} />}

              {meetingVisitors.length === 0 ? (
                <div className="empty">
                  <b>No visitors registered for this meeting.</b>
                  Visitors registered for this chapter meeting appear here.
                </div>
              ) : (
                <ul className="plist">
                  {searchedVisitors.map((v) => {
                    const inv = v.invitedById ? memberMap.get(v.invitedById) : undefined
                    return (
                      <li key={v.id} className="prow">
                        <div className="glyph t-navy" style={{ '--size': '44px' } as any}>
                          <UserPlus size={20} />
                        </div>
                        <div className="prow__main">
                          <b>{v.name}</b>
                          <span>{v.phone}</span>
                          {inv && (
                            <span className="prow__meta" style={{ color: 'var(--ink)' }}>
                              Invited by: <b>{inv.name}</b>
                            </span>
                          )}
                          {v.notes && <span className="prow__meta">Note: {v.notes}</span>}
                        </div>
                        <div className="prow__side" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <span className="stat stat--ok">Visitor</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
