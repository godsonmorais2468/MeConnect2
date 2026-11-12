import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Check, CircleCheck, Heart, Lock, Mail, Phone, Save, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import DayMonthField from '../../components/DayMonthField'
import { Avatar, Field, FieldGroup, PhotoField } from '../../components/ui'
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

/* the four sections; each owns some checklist items, so it can show how much of it is filled in */
const STEPS: { id: string; icon: LucideIcon; title: string; note: string; keys: string[] }[] = [
  { id: 'account', icon: Lock, title: 'Account', note: 'Name and mobile number cannot be changed here', keys: [] },
  { id: 'business', icon: Briefcase, title: 'Business', note: 'Where you work and how you look', keys: ['photo', 'designation', 'organisation', 'category', 'joined'] },
  { id: 'contact', icon: Mail, title: 'Contact and social', note: 'How members can reach you', keys: ['email', 'website', 'social'] },
  { id: 'personal', icon: Heart, title: 'Personal', note: 'Birthday and family', keys: ['dob', 'married', 'anniversary', 'spouse'] },
]
const stepOf = (key: string) => STEPS.find((s) => s.keys.includes(key))?.id ?? 'business'

/* the ring around the photo */
const R = 66
const C = 2 * Math.PI * R

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
  const [active, setActive] = useState('account')

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
  const missing = items.filter((i) => !i.done)

  /* the section nearest the top of the screen lights up in the rail */
  useEffect(() => {
    const els = STEPS.map((s) => document.getElementById(`pfx-${s.id}`)).filter((e): e is HTMLElement => !!e)
    const io = new IntersectionObserver(
      (list) => {
        const hit = list.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (hit) setActive(hit.target.id.replace('pfx-', ''))
      },
      { rootMargin: '-25% 0px -60% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])

  function go(id: string) {
    setActive(id)
    document.getElementById(`pfx-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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
    <div className="page pfx">
      <header className="pfx-hero">
        <div className="pfx-id">
          <svg className="pfx-id__ring" width="152" height="152" viewBox="0 0 152 152" aria-hidden>
            <circle cx="76" cy="76" r={R} fill="none" strokeWidth="6" className="pfx-id__bg" />
            <circle cx="76" cy="76" r={R} fill="none" strokeWidth="6" strokeLinecap="round" className="pfx-id__fg" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 76 76)" />
          </svg>
          <span className="pfx-id__photo">
            <Avatar name={member.name} photo={photo} size={116} />
          </span>
          <span className="pfx-id__pct" role="img" aria-label={`${pct} percent complete`}>
            {pct}%
          </span>
        </div>
        <div className="pfx-who">
          <p className="pfx-who__eyebrow">{first ? 'Set up your profile' : 'Your profile'}</p>
          <h1>{member.name}</h1>
          <p className="pfx-who__role">{[designation, organisation].filter(Boolean).join(' · ') || 'Add your designation and company'}</p>
          <p className="pfx-who__meta">
            <Phone size={14} /> {member.mobile}
            {category && (
              <>
                <i /> {category}
              </>
            )}
          </p>
          <p className="pfx-who__sub">{first ? 'Add a few details so other members can reach you. You can skip this and finish later.' : 'Keep your details up to date.'}</p>
        </div>
        {first && (
          <button
            className="pfx-skip"
            type="button"
            onClick={() => {
              skipProfile(member.id)
              navigate('/')
            }}
          >
            Skip for now
          </button>
        )}
      </header>

      <div className="pfx-todo" aria-label="Profile progress">
        {missing.length ? (
          <>
            <span className="pfx-todo__lead">
              <Sparkles size={15} /> Still to add
            </span>
            <ul>
              {missing.map((i) => (
                <li key={i.key}>
                  <button type="button" onClick={() => go(stepOf(i.key))}>
                    {i.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <span className="pfx-todo__lead pfx-todo__lead--done">
            <CircleCheck size={16} /> Everything is filled in. Nice work.
          </span>
        )}
      </div>

      <div className="pfx-body">
        <nav className="pfx-rail" aria-label="Profile sections">
          {STEPS.map((s, n) => {
            const own = items.filter((i) => s.keys.includes(i.key))
            const done = own.filter((i) => i.done).length
            const full = own.length === 0 || done === own.length
            return (
              <button key={s.id} type="button" className={`${active === s.id ? 'is-on ' : ''}${full ? 'is-full' : ''}`} onClick={() => go(s.id)}>
                <i>{full ? <Check size={13} strokeWidth={3} /> : n + 1}</i>
                <span>{s.title}</span>
                {own.length > 0 && (
                  <small>
                    {done}/{own.length}
                  </small>
                )}
              </button>
            )
          })}
        </nav>

        <form id="pfx-form" className="pfx-form" onSubmit={submit} noValidate>
          <Step s={STEPS[0]} items={items}>
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
          </Step>

          <Step s={STEPS[1]} items={items}>
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
            <div className="pfx-wide">
              <PhotoField
                label="Photo (Max Size 2MB)"
                value={photo}
                onChange={(url) => {
                  setPhoto(url)
                  setMemberPhoto(member.id, url)
                }}
              />
            </div>
          </Step>

          <Step s={STEPS[2]} items={items}>
            <Field label="Email" error={errors.email}>
              <input className="field__control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
            </Field>
            <Field label="Website" error={errors.website}>
              <input className="field__control" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.example.com" />
            </Field>
            <div className="pfx-wide">
              <Field label="Social media" error={errors.social}>
                <input className="field__control" value={social} onChange={(e) => setSocial(e.target.value)} placeholder="Instagram, LinkedIn or Facebook link" />
              </Field>
            </div>
          </Step>

          <Step s={STEPS[3]} items={items}>
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
          </Step>

          {errors.form && <div className="form-error">{errors.form}</div>}
        </form>
      </div>

      {/* outside the form so it can stay pinned to the bottom of the whole page; its button still submits the form */}
      <div className="pfx-save">
        <div className="pfx-save__meter" aria-hidden>
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className="pfx-save__txt">
          <b>{pct}%</b> complete
        </span>
        {!first && (
          <button className="pfx-btn pfx-btn--ghost" type="button" onClick={() => navigate('/')}>
            Cancel
          </button>
        )}
        <button className="pfx-btn" type="submit" form="pfx-form" disabled={saving}>
          <Save size={16} /> {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </div>
  )
}

/** One numbered section of the form. */
function Step({ s, items, children }: { s: (typeof STEPS)[number]; items: { key: string; done: boolean }[]; children: ReactNode }) {
  const own = items.filter((i) => s.keys.includes(i.key))
  const done = own.filter((i) => i.done).length
  const Icon = s.icon
  return (
    <section className="pfx-step" id={`pfx-${s.id}`} aria-labelledby={`pfx-${s.id}-t`}>
      <header className="pfx-step__head">
        <span className="pfx-step__ico">
          <Icon size={19} />
        </span>
        <div>
          <h2 id={`pfx-${s.id}-t`}>{s.title}</h2>
          <p>{s.note}</p>
        </div>
        {own.length > 0 && (
          <span className={`pfx-step__count${done === own.length ? ' is-full' : ''}`}>
            {done}/{own.length}
          </span>
        )}
      </header>
      <div className="pfx-grid">{children}</div>
    </section>
  )
}
