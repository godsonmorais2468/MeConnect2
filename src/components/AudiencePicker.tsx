import { useState } from 'react'
import { Search, Users, X } from 'lucide-react'
import { Avatar, FieldGroup } from './ui'
import { matches } from '../lib/search'
import type { Member, MeetingAudience } from '../lib/types'

export interface AudienceChoice {
  audience: MeetingAudience
  designations: string[]
  memberIds: string[]
}

const OPTIONS: { value: MeetingAudience; label: string }[] = [
  { value: 'all', label: 'All members' },
  { value: 'designations', label: 'Designations' },
  { value: 'members', label: 'Selected' },
]

/**
 * Who a meeting is for: every member, the members holding chosen designations (searchable), or members picked one by one.
 * `members` are the people of the chapter who can sign in; `designations` are the names offered; `invited` is how many people
 * the choice reaches, worked out by the page (the head table is always included).
 */
export default function AudiencePicker({
  value,
  onChange,
  members,
  designations,
  invited,
  error,
}: {
  value: AudienceChoice
  onChange: (next: AudienceChoice) => void
  members: Member[]
  designations: string[]
  invited: number
  error?: string
}) {
  const [query, setQuery] = useState('')
  const q = query.trim()

  const heldBy = (name: string) => members.filter((m) => m.designation === name).length
  const shownDesignations = designations.filter((d) => matches(q, d))
  const shownMembers = members.filter((m) => matches(q, m.name, m.mobile, m.designation, m.organisation, m.category))
  const allShownPicked = shownMembers.length > 0 && shownMembers.every((m) => value.memberIds.includes(m.id))

  const toggleDesignation = (name: string) =>
    onChange({ ...value, designations: value.designations.includes(name) ? value.designations.filter((d) => d !== name) : [...value.designations, name] })
  const toggleMember = (id: string) =>
    onChange({ ...value, memberIds: value.memberIds.includes(id) ? value.memberIds.filter((x) => x !== id) : [...value.memberIds, id] })
  const toggleAllShown = () => {
    const ids = shownMembers.map((m) => m.id)
    onChange({ ...value, memberIds: allShownPicked ? value.memberIds.filter((id) => !ids.includes(id)) : [...new Set([...value.memberIds, ...ids])] })
  }

  return (
    <FieldGroup label="Meeting for" required error={error}>
      <div className="seg seg--fill" role="group">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value.audience === o.value}
            onClick={() => {
              setQuery('')
              onChange({ ...value, audience: o.value })
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {value.audience === 'designations' && (
        <div className="pick">
          {value.designations.length > 0 && (
            <div className="chips">
              {value.designations.map((d) => (
                <button key={d} type="button" className="chip chip--gold" onClick={() => toggleDesignation(d)} aria-label={`Remove ${d}`}>
                  {d} <X size={12} />
                </button>
              ))}
            </div>
          )}
          <div className="pick__bar">
            <label className="pick__search">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search designations" aria-label="Search designations" />
            </label>
          </div>
          <ul className="pick__list">
            {shownDesignations.length === 0 && <li className="pick__none">No designation matches “{query}”.</li>}
            {shownDesignations.map((d) => (
              <li key={d}>
                <label className={`pick__row ${value.designations.includes(d) ? 'is-on' : ''}`}>
                  <input type="checkbox" checked={value.designations.includes(d)} onChange={() => toggleDesignation(d)} />
                  <span className="pick__who">
                    <b>{d}</b>
                    <small>
                      {heldBy(d)} {heldBy(d) === 1 ? 'member' : 'members'}
                    </small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {value.audience === 'members' && (
        <div className="pick">
          <div className="pick__bar">
            <label className="pick__search">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members" aria-label="Search members" />
            </label>
            <label className="check pick__all">
              <input type="checkbox" checked={allShownPicked} onChange={toggleAllShown} /> Select all{q ? ` (${shownMembers.length})` : ''}
            </label>
          </div>
          <ul className="pick__list">
            {shownMembers.length === 0 && <li className="pick__none">No member matches “{query}”.</li>}
            {shownMembers.map((m) => (
              <li key={m.id}>
                <label className={`pick__row ${value.memberIds.includes(m.id) ? 'is-on' : ''}`}>
                  <input type="checkbox" checked={value.memberIds.includes(m.id)} onChange={() => toggleMember(m.id)} />
                  <Avatar name={m.name} photo={m.photo} size={34} />
                  <span className="pick__who">
                    <b>{m.name}</b>
                    <small>{m.organisation || m.designation}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="pick__count">
            <Users size={14} /> {value.memberIds.length} of {members.length} selected
          </div>
        </div>
      )}

      <p className="field__hint">
        {invited} {invited === 1 ? 'member' : 'members'} will be invited{value.audience === 'all' ? '' : ' (the head table is always included)'}.
      </p>
    </FieldGroup>
  )
}
