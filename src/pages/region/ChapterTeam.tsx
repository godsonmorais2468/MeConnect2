import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound, Lock, Pencil, Plus, Trash2, Users } from 'lucide-react'
import SearchSelect from '../../components/SearchSelect'
import { Avatar, Field, PageHead, PhotoField, Sheet, StatStrip, Toggle } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { designationOptions } from '../../lib/designations'
import { createTeamMember, deleteTeamMember, lookupTeamMobile, resetTeamMemberPin, updateTeamMember, useDB } from '../../lib/store'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import type { Member } from '../../lib/types'

export default function ChapterTeam() {
  const { region, role, member } = useAuth()
  /* A head table member runs the team of their own chapter only: the chapter is fixed and cannot be changed. */
  const lockedChapter = role === 'member' ? (member?.chapterId ?? '') : ''
  const db = useDB()
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<string | null>(null)
  const [chosenChapter, setChapterId] = useState(lockedChapter)
  const [designation, setDesignation] = useState('')
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  /* a number that already belongs to a member of another chapter: they are added here with their own login and PIN */
  const [existing, setExisting] = useState<{ name: string; alreadyInChapter: boolean; mode: 'login' | 'listed' | 'none'; homeChapter: string } | null>(null)
  const [filter, setFilter] = useState('')
  const [q, setQ] = useState('')

  if (!region) return null
  const chapters = db.chapters.filter((c) => c.regionId === region.id && (!lockedChapter || c.id === lockedChapter))
  const people = db.members
    .filter((m) => m.regionId === region.id && (lockedChapter ? m.chapterId === lockedChapter : !filter || m.chapterId === filter))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  const shown = people.filter((m) => matches(q, m.name, m.designation, m.organisation, m.mobile, m.profile.email, chapters.find((c) => c.id === m.chapterId)?.name))
  const chapterId = lockedChapter || chosenChapter
  const regionMembers = db.members.filter((m) => m.regionId === region.id && (!lockedChapter || m.chapterId === lockedChapter))
  const chapterName = (id: string) => chapters.find((c) => c.id === id)?.name ?? 'Chapter'
  const current = editing ? db.members.find((m) => m.id === editing) : undefined
  /* a person only listed in this chapter: their name, number and details belong to the chapter they sign in to */
  const listedOnly = Boolean(current && current.loginEnabled === false)
  /* an inactive chapter cannot be picked for a new person; a person already in one keeps it while edited */
  const openChapters = chapters.filter((c) => c.isActive !== false || c.id === current?.chapterId)
  const designations = designationOptions(db, region.id, current?.designation ?? '', chapterId)

  function reset() {
    setEditing(null)
    setChapterId(lockedChapter)
    setDesignation('')
    setName('')
    setPhoto('')
    setOrganisation('')
    setMobile('')
    setEmail('')
    setPin('')
    setShowPin(false)
    setIsActive(true)
    setExisting(null)
    setErrors({})
  }

  /** Looks the number up when it is complete (and a chapter is chosen), so an existing member can be added to this chapter. */
  async function checkNumber(number: string, forChapter: string) {
    if (editing || !/^\d{10}$/.test(number) || !forChapter) return setExisting(null)
    const found = await lookupTeamMobile(number, forChapter)
    setExisting(found.exists ? { name: found.name ?? '', alreadyInChapter: Boolean(found.alreadyInChapter), mode: found.mode ?? 'none', homeChapter: found.homeChapter ?? '' } : null)
    if (found.exists && found.name) setName(found.name)
  }

  function startEdit(m: Member) {
    setEditing(m.id)
    setChapterId(m.chapterId)
    setDesignation(m.designation)
    setName(m.name)
    setPhoto(m.photo)
    setOrganisation(m.organisation)
    setMobile(m.mobile)
    setEmail(m.profile.email)
    setPin('')
    setIsActive(m.isActive !== false)
    setExisting(null)
    setErrors({})
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    const chapterId = lockedChapter || chosenChapter
    if (!chapterId) next.chapterId = 'Select a chapter.'
    if (!designation) next.designation = 'Select a designation.'
    if (!name.trim()) next.name = 'Enter the name.'
    if (!/^\d{10}$/.test(mobile)) next.mobile = 'Enter a 10-digit phone number.'
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.'
    if (existing?.alreadyInChapter) next.mobile = 'This person is already a member of this chapter.'
    else if (existing?.mode === 'none') next.mobile = `${existing.name} cannot be added to another chapter. Their designation needs Multiple Chapter Login or Multiple Chapter Add Only ticked.`
    if (!editing && !existing && !/^\d{4}$/.test(pin)) next.pin = 'Enter a 4-digit initial password.'
    if (editing && pin && !/^\d{4}$/.test(pin)) next.pin = 'The password must be a 4-digit number.'
    setErrors(next)
    if (Object.keys(next).length) return
    const input = { chapterId, designation, name, photo, organisation, mobile, email, pin, isActive, joinExisting: Boolean(existing) }
    const res = editing ? await updateTeamMember(editing, input) : await createTeamMember(input)
    if (res.error) return setErrors({ [res.field ?? 'form']: res.error })
    toast(`${name.trim()} ${editing ? 'updated' : 'added to the team'}`)
    reset()
  }

  async function remove(m: Member) {
    if (!(await confirm({ title: 'Delete team member?', message: `${m.name} will be removed from the chapter team and can no longer log in.` }))) return
    const res = await deleteTeamMember(m.id)
    if (res.error) return toast(res.error, 'info')
    toast(`${m.name} deleted`)
    if (editing === m.id) reset()
  }

  async function resetPassword(m: Member) {
    if (!(await confirm({ title: 'Reset password?', message: `${m.name}'s password will be set to 1234. They must choose their own MPIN the next time they log in. If they belong to more than one chapter, this applies to all of them.`, confirmLabel: 'Reset' }))) return
    const res = await resetTeamMemberPin(m.id)
    if (res.error) return toast(res.error, 'info')
    toast(`${m.name}'s password reset to 1234`)
  }

  const hasRecords = (m: Member) => db.invoices.some((i) => i.memberId === m.id) || db.attendance.some((a) => a.memberId === m.id)
  const isMe = (m: Member) => m.id === member?.id

  return (
    <div className="page">
      <PageHead
        eyebrow={lockedChapter ? `Head Table · ${chapterName(lockedChapter)}` : `Region Admin · ${region.name}`}
        icon={Users}
        tone="green"
        title="Chapter Team"
        subtitle={lockedChapter ? 'Add the people of your chapter and give each one a login.' : 'Add the people of your chapters and give each one a login.'}
      />

      <StatStrip
        items={[
          { icon: Users, tone: 'green', label: 'People', value: regionMembers.length },
          { icon: Users, tone: 'wine', label: 'Login off', value: regionMembers.filter((m) => m.isActive === false).length },
        ]}
      />

      <div className="duo">
        <Sheet icon={editing ? Pencil : Plus} tone="green" title={editing ? 'Edit team member' : 'Add team member'} note={region.name}>
          <form className="form-stack" onSubmit={submit} noValidate>
            <Field label="Chapter" required error={errors.chapterId}>
              <SearchSelect
                value={chapterId}
                onChange={(id) => {
                  setChapterId(id)
                  void checkNumber(mobile, id)
                }}
                options={openChapters.map((c) => ({ id: c.id, name: c.name }))}
                placeholder="Select Chapter"
                disabled={Boolean(lockedChapter)}
                ariaLabel="Chapter"
              />
            </Field>
            <Field label="Designation" required error={errors.designation}>
              <SearchSelect value={designation} onChange={setDesignation} options={designations.map((d) => ({ id: d, name: d }))} placeholder="Select Designation" ariaLabel="Designation" />
            </Field>
            <Field label="Name" required error={errors.name}>
              <input className="field__control" value={name} disabled={Boolean(existing) || listedOnly} onChange={(e) => setName(e.target.value)} />
            </Field>
            {listedOnly && <p className="field__hint">Only listed here. Their name, photo and details come from {current?.homeChapterName || 'their chapter'}; here you can change the designation and switch them on or off.</p>}
            {!listedOnly && <PhotoField label="Photo (Max Size 2MB)" value={photo} onChange={setPhoto} />}
            <Field label="Organization">
              <input className="field__control" value={organisation} disabled={listedOnly} onChange={(e) => setOrganisation(e.target.value)} />
            </Field>
            <Field label="Phone Number" required hint="Used to log in" error={errors.mobile}>
              <input className="field__control" inputMode="numeric" placeholder="10-digit phone number" value={mobile} disabled={listedOnly} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setMobile(v); void checkNumber(v, chapterId) }} />
            </Field>
            {existing && (
              <p className={existing.alreadyInChapter || existing.mode === 'none' ? 'form-error' : 'field__hint'}>
                {existing.alreadyInChapter
                  ? `${existing.name} is already a member of this chapter.`
                  : existing.mode === 'none'
                    ? `${existing.name} cannot be added to another chapter. Their designation needs Multiple Chapter Login or Multiple Chapter Add Only ticked.`
                    : existing.mode === 'listed'
                      ? `${existing.name} is registered in ${existing.homeChapter || 'another chapter'}. They will only be listed here with the designation you choose. They cannot sign in to this chapter.`
                      : `${existing.name} is already registered in another chapter. They will be added here with their own login and PIN, and can switch between the chapters.`}
              </p>
            )}
            <Field label="Email ID" error={errors.email}>
              <input className="field__control" type="email" inputMode="email" autoComplete="off" placeholder="name@example.com" value={email} disabled={listedOnly} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {!existing && !listedOnly && (
            <div className="field">
              <label className="field__label" htmlFor="team-pin">
                Initial Password{!editing && <span className="req">*</span>}
              </label>
              <span className="field__hint">4-digit number for the first login — the member then sets their own MPIN{editing ? '. Leave blank to keep the current one.' : ''}</span>
              <input
                id="team-pin"
                className="field__control"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="new-password"
                placeholder="Enter a 4-digit pin"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
              <label className="check">
                <input type="checkbox" checked={showPin} onChange={(e) => setShowPin(e.target.checked)} /> Show Password
              </label>
              {errors.pin && <span className="field__error">{errors.pin}</span>}
            </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px' }}>
              <span style={{ fontWeight: 500, fontSize: '14.5px' }}>Active/Deactive</span>
              <Toggle checked={isActive} onChange={setIsActive} label="Login active or deactive" />
            </div>
            {errors.form && <div className="form-error">{errors.form}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn--primary" type="submit">
                {editing ? <Pencil size={16} /> : <Plus size={16} />} {editing ? 'Update' : 'Save'}
              </button>
              {editing && (
                <button className="btn btn--ghost" type="button" onClick={reset}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Sheet>

        <div className="list">
          <h2 className="list__title">
            Chapter team <span>{people.length}</span>
          </h2>
          {!lockedChapter && (
            <SearchSelect value={filter} onChange={setFilter} options={chapters.filter((c) => c.isActive !== false).map((c) => ({ id: c.id, name: c.name }))} placeholder="All chapters" ariaLabel="Filter by chapter" />
          )}
          <ListSearch value={q} onChange={setQ} placeholder="Search the team" />
          {q && shown.length === 0 && people.length > 0 && <NoMatch query={q} />}
          {people.length === 0 ? (
            <div className="empty">
              <b>No one here yet.</b>
              Add the first team member with the form.
            </div>
          ) : (
            shown.map((m) => (
              <article key={m.id} className="row" style={{ opacity: m.isActive === false ? 0.7 : 1 }}>
                <div className="row__acts">
                  <button type="button" className="btn btn--ghost btn--sm" title="Edit" aria-label={`Edit ${m.name}`} onClick={() => startEdit(m)} style={{ padding: '6px 8px' }}>
                    <Pencil size={15} />
                  </button>
                  {hasRecords(m) || isMe(m) ? (
                    <button type="button" className="btn btn--ghost btn--sm" disabled title={isMe(m) ? 'You cannot delete your own login.' : 'Locked: has payment or attendance records. Mark inactive instead.'} style={{ padding: '6px 8px', color: 'var(--ink-mute)', opacity: 0.45, cursor: 'not-allowed' }}>
                      <Lock size={14} />
                    </button>
                  ) : (
                    <button type="button" className="btn btn--ghost btn--sm" title="Delete" aria-label={`Delete ${m.name}`} onClick={() => remove(m)} style={{ padding: '6px 8px', color: '#ef4444' }}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <Avatar name={m.name} photo={m.photo} size={50} />
                <div className="row__main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <b>{m.name}</b>
                    {m.isActive === false && <span className="stat stat--bad">Login off</span>}
                    {m.loginEnabled === false && <span className="chip">Listed only · signs in at {m.homeChapterName || 'another chapter'}</span>}
                  </div>
                  <span>
                    {m.designation}
                    {m.organisation ? ` · ${m.organisation}` : ''}
                  </span>
                  <span>{m.mobile}</span>
                  {m.profile.email && <span>{m.profile.email}</span>}
                </div>
                <div className="chips">
                  <span className="chip chip--gold">{chapterName(m.chapterId)}</span>
                  {!isMe(m) && m.loginEnabled !== false && (
                    <button type="button" className="btn btn--xs" onClick={() => resetPassword(m)}>
                      <KeyRound size={13} /> Reset Password
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
