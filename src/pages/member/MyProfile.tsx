import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Circle, CircleCheck, Heart, Lock, Mail, Save, UserRound } from 'lucide-react'
import DayMonthField from '../../components/DayMonthField'
import { Field, FieldGroup, PageHead, PhotoField, Ring, Sheet } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { withoutYear } from '../../lib/dayMonth'
import { dayOf } from '../../lib/dues'
import { designationOptions } from '../../lib/designations'
import { normalizeLink } from '../../lib/links'
import { checklist, percent } from '../../lib/profile'
import { saveProfile, setMemberPhoto, skipProfile, useDB } from '../../lib/store'
import { useToast } from '../../lib/toast'
import type { Married, Member } from '../../lib/types'

/* the date of joining cannot be after today */
const TODAY = dayOf(Date.now())

export default function MyProfile() {
  const { member } = useAuth()
  if (!member) return null
  /* The form is filled from the saved record when it opens. If that record changes while the page is open (the
     background refresh finishing, or an edit made on another device), the form starts again from the new values
     instead of showing, and saving, old ones. The photo is left out: it saves the moment it is chosen. */
  const saved = JSON.stringify([member.designation, member.organisation, member.category, member.profile])
  return <ProfileForm key={`${member.id}:${saved}`} member={member} />
}

function ProfileForm({ member }: { member: Member }) {
  const navigate = useNavigate()
  const toast = useToast()
  const db = useDB()
  const first = member.profileState === 'pending'

  const [designation, setDesignation] = useState(member.designation)
  const [organisation, setOrganisation] = useState(member.organisation)
  const [category, setCategory] = useState(member.category)
  const [photo, setPhoto] = useState(member.photo)
  const [email, setEmail] = useState(member.profile.email)
  const [website, setWebsite] = useState(member.profile.website)
  const [social, setSocial] = useState(member.profile.social)
  const [dob, setDob] = useState(member.profile.dob)
  const [married, setMarried] = useState<Married>(member.profile.married)
  const [anniversary, setAnniversary] = useState(member.profile.anniversary)
  const [spouse, setSpouse] = useState(member.profile.spouse)
  const [joined, setJoined] = useState(member.profile.dateOfJoining)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  /* The progress ring follows the form as it is filled in. */
  const draft: Member = {
    ...member,
    designation,
    organisation,
    category,
    photo,
    profile: { email, website, social, dob, married, anniversary, spouse, dateOfJoining: joined },
  }
  const items = checklist(draft)
  const pct = percent(draft)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    const next: Record<string, string> = {}
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.'
    if (website.trim() && !/^\S+\.\S+$/.test(website.trim())) next.website = 'Enter a valid website, e.g. www.example.com.'
    if (married === 'yes') {
      if (!anniversary) next.anniversary = 'Select the day and month of your anniversary.'
      if (!spouse.trim()) next.spouse = 'Enter your spouse’s name.'
    }
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    const res = await saveProfile(member.id, {
      designation,
      organisation,
      category,
      photo,
      profile: {
        email: email.trim(),
        website: normalizeLink(website),
        social: normalizeLink(social),
        dob: withoutYear(dob),
        married,
        anniversary: married === 'yes' ? withoutYear(anniversary) : '',
        spouse: married === 'yes' ? spouse.trim() : '',
        dateOfJoining: joined,
      },
    })
    setSaving(false)
    if (res.error) {
      /* stay on the page and say what went wrong, so nothing looks saved when it was not */
      setErrors(res.field && ['email', 'website', 'social'].includes(res.field) ? { [res.field]: res.error } : res.field === 'date_of_joining' ? { joined: res.error } : { form: res.error })
      return
    }
    toast('Profile saved')
    navigate('/')
  }

  return (
    <div className="page">
      <PageHead
        eyebrow="My profile"
        icon={UserRound}
        tone="gold"
        title={first ? 'Update your profile' : 'Your profile'}
        subtitle={first ? 'Add a few details so other members can reach you. You can skip this and finish later.' : 'Keep your details up to date.'}
        actions={
          first && (
            <button
              className="btn btn--line"
              onClick={() => {
                skipProfile(member.id)
                navigate('/')
              }}
            >
              Skip for now
            </button>
          )
        }
      />

      <form className="pf" onSubmit={submit} noValidate>
        <div className="pf__main">
          <Sheet icon={Lock} tone="steel" title="Account" note="Name and mobile number cannot be changed here">
            <div className="form-grid">
              <Field label="Name">
                <span className="lockwrap">
                  <input className="field__control" value={member.name} disabled />
                  <Lock size={16} />
                </span>
              </Field>
              <Field label="Mobile number">
                <span className="lockwrap">
                  <input className="field__control" value={member.mobile} disabled />
                  <Lock size={16} />
                </span>
              </Field>
            </div>
          </Sheet>

          <Sheet icon={Briefcase} tone="wine" title="Business">
            <div className="form-grid">
              <Field label="Designation">
                <select className="field__control native-select" value={designation} onChange={(e) => setDesignation(e.target.value)}>
                  {designationOptions(db, member.regionId, member.designation, member.chapterId).map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </Field>
              <Field label="Organization">
                <input className="field__control" value={organisation} onChange={(e) => setOrganisation(e.target.value)} />
              </Field>
              <Field label="Category">
                <input className="field__control" value={category} onChange={(e) => setCategory(e.target.value)} />
              </Field>
              <Field label="Date of joining (in ME-CONNECT)" error={errors.joined}>
                <input className="field__control" type="date" max={TODAY} value={joined} onChange={(e) => setJoined(e.target.value)} />
              </Field>
              <PhotoField
                label="Photo (Max Size 2MB)"
                value={photo}
                onChange={(url) => {
                  setPhoto(url)
                  setMemberPhoto(member.id, url)
                }}
              />
            </div>
          </Sheet>

          <Sheet icon={Mail} tone="red" title="Contact and social">
            <div className="form-grid">
              <Field label="Email" error={errors.email}>
                <input className="field__control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
              </Field>
              <Field label="Website" error={errors.website}>
                <input className="field__control" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.example.com" />
              </Field>
              <Field label="Social media" error={errors.social}>
                <input className="field__control" value={social} onChange={(e) => setSocial(e.target.value)} placeholder="Instagram, LinkedIn or Facebook link" />
              </Field>
            </div>
          </Sheet>

          <Sheet icon={Heart} tone="wine" title="Personal">
            <div className="form-grid">
              <DayMonthField label="Birthday" value={dob} onChange={setDob} />
              <FieldGroup label="Married?">
                <div className="seg" role="group">
                  <button type="button" aria-pressed={married === 'yes'} onClick={() => setMarried('yes')}>
                    Yes
                  </button>
                  <button type="button" aria-pressed={married === 'no'} onClick={() => setMarried('no')}>
                    No
                  </button>
                </div>
              </FieldGroup>
              {married === 'yes' && (
                <>
                  <DayMonthField label="Anniversary" required error={errors.anniversary} value={anniversary} onChange={setAnniversary} />
                  <Field label="Spouse name" required error={errors.spouse}>
                    <input className="field__control" value={spouse} onChange={(e) => setSpouse(e.target.value)} />
                  </Field>
                </>
              )}
            </div>
          </Sheet>

          {errors.form && <div className="form-error">{errors.form}</div>}
          <div className="pf__foot">
            <button className="btn btn--primary" type="submit" disabled={saving}>
              <Save size={16} /> {saving ? 'Saving…' : 'Save profile'}
            </button>
            {!first && (
              <button className="btn btn--ghost" type="button" onClick={() => navigate('/')}>
                Cancel
              </button>
            )}
          </div>
        </div>

        <aside className="pf__side glass" aria-label="Profile progress">
          <Ring pct={pct} size={150} label="complete" />
          <ul className="checks">
            {items.map((i) => (
              <li key={i.key} className={i.done ? 'is-done' : ''}>
                {i.done ? <CircleCheck size={17} /> : <Circle size={17} />}
                {i.label}
              </li>
            ))}
          </ul>
        </aside>
      </form>
    </div>
  )
}
