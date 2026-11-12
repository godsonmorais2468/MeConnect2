import { useState } from 'react'
import type { FormEvent } from 'react'
import { Landmark, Lock, MapPin, Pencil, Plus, Smartphone, Trash2, Users } from 'lucide-react'
import { Avatar, Field, Glyph, PageHead, PhotoField, Sheet, StatStrip, Toggle } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { fmtDate } from '../../lib/format'
import { createChapter, deleteChapter, updateChapter, useDB } from '../../lib/store'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import type { Chapter } from '../../lib/types'

export default function Chapters() {
  const { region } = useAuth()
  const db = useDB()
  const [q, setQ] = useState('')
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [logo, setLogo] = useState('')
  const [logoName, setLogoName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!region) return null
  const chapters = db.chapters.filter((c) => c.regionId === region.id)
  const shown = chapters.filter((c) => matches(q, c.code, c.name, c.description))
  const limit = region.maxChapters ?? 0
  const limitReached = limit > 0 && chapters.length >= limit
  /* Editing a chapter that already exists never needs a free place. */
  const blocked = limitReached && !editing

  function resetForm() {
    setEditing(null)
    setCode('')
    setName('')
    setLogo('')
    setLogoName('')
    setDescription('')
    setIsActive(true)
    setErrors({})
  }

  function startEdit(c: Chapter) {
    setEditing(c.id)
    setCode(c.code || '')
    setName(c.name)
    setLogo(c.logo || '')
    setLogoName(c.logoName || '')
    setDescription(c.description || '')
    setIsActive(c.isActive !== false)
    setErrors({})
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!region) return
    const next: Record<string, string> = {}
    if (!code.trim()) next.code = 'Enter the chapter code.'
    else if (!/^[A-Za-z0-9-]{2,20}$/.test(code.trim())) next.code = 'Code can use letters, numbers and hyphens only (2 to 20 characters).'
    if (!name.trim()) next.name = 'Enter the chapter name.'
    setErrors(next)
    if (Object.keys(next).length) return
    const res = editing ? await updateChapter(editing, { code, name, logo, logoName, description, isActive }) : await createChapter(region.id, { code, name, logo, logoName, description, isActive })
    if (res.error) return setErrors({ [res.field ?? 'form']: res.error })
    toast(`Chapter ${name.trim()} ${editing ? 'updated' : 'created'}`)
    resetForm()
  }

  async function removeChapter(c: Chapter) {
    if (!(await confirm({ title: 'Delete chapter?', message: `"${c.name}" will be removed. This cannot be undone.` }))) return
    const res = await deleteChapter(c.id)
    if (res.error) {
      toast(res.error, 'info')
      return
    }
    toast(`Chapter "${c.name}" deleted`)
    if (editing === c.id) resetForm()
  }

  return (
    <div className="page">
      <PageHead
        eyebrow={`Region Admin · ${region.name}`}
        icon={Landmark}
        tone="wine"
        title="Chapters"
        subtitle="Create the chapters of your region."
      />

      <StatStrip
        items={[
          {
            icon: Landmark,
            tone: 'wine',
            label: 'Chapters',
            value: region.maxChapters && region.maxChapters > 0 ? `${chapters.length} / ${region.maxChapters}` : chapters.length
          },
          { icon: Users, tone: 'green', label: 'Members', value: db.members.filter((m) => m.regionId === region.id).length },
        ]}
      />

      <div className="duo">
        <Sheet icon={editing ? Pencil : Plus} tone="wine" title={editing ? 'Edit chapter' : 'Create chapter'} note={region.name}>
          {limit > 0 && (
            <div className={`quota-banner ${limitReached ? 'quota-banner--warn quota-banner--stack' : ''}`}>
              <span>
                Chapters created: {chapters.length} of {limit}
              </span>
              {limitReached && <span>Limit reached. Ask the superadmin to increase the number of chapters.</span>}
            </div>
          )}

          <form className="form-stack" onSubmit={submit} noValidate>
            <Field label="Code" required error={errors.code}>
              <input className="field__control" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={20} autoCapitalize="characters" />
            </Field>
            <Field label="Chapter" required error={errors.name}>
              <input className="field__control" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <PhotoField
              label="Upload Chapter Logo"
              value={logo}
              fileName={logoName}
              onChange={(url, file) => {
                setLogo(url)
                setLogoName(file ?? '')
              }}
            />
            <Field label="Description">
              <textarea className="field__control" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
            </Field>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px' }}>
              <span style={{ fontWeight: 500, fontSize: '14.5px' }}>Active/Deactive</span>
              <Toggle checked={isActive} onChange={setIsActive} label="Chapter active or deactive" />
            </div>
            {errors.form && <div className="form-error">{errors.form}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn--primary" type="submit" disabled={blocked}>
                {editing ? <Pencil size={16} /> : <Plus size={16} />} {editing ? 'Update' : 'Save'}
              </button>
              {editing && (
                <button className="btn btn--ghost" type="button" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Sheet>

        <div className="list">
          <h2 className="list__title">
            All chapters <span>{chapters.length}</span>
          </h2>
          <ListSearch value={q} onChange={setQ} placeholder="Search chapters" />
          {q && shown.length === 0 && chapters.length > 0 && <NoMatch query={q} />}
          {chapters.length === 0 ? (
            <div className="empty">
              <b>No chapters yet.</b>
              Create the first one with the form.
            </div>
          ) : (
            shown.map((c) => (
              <article key={c.id} className={`row ${db.members.some((m) => m.chapterId === c.id) ? 'row--green' : ''}`}>
                <div className="row__acts">
                  <button type="button" className="btn btn--ghost btn--sm" title="Edit chapter" aria-label={`Edit ${c.name}`} onClick={() => startEdit(c)} style={{ padding: '6px 8px' }}>
                    <Pencil size={15} />
                  </button>
                  {(() => {
                    const membersCount = db.members.filter((m) => m.chapterId === c.id).length
                    if (membersCount > 0) {
                      return (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          disabled
                          title={`Locked: Contains ${membersCount} member(s). Delete or transfer members first to unlock.`}
                          style={{
                            padding: '6px 8px',
                            color: 'var(--ink-mute)',
                            opacity: 0.45,
                            cursor: 'not-allowed',
                          }}
                        >
                          <Lock size={14} />
                        </button>
                      )
                    }

                    return (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        title="Delete chapter (unlocked: 0 members)"
                        onClick={() => removeChapter(c)}
                        style={{ padding: '6px 8px', color: '#ef4444' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )
                  })()}
                </div>
                {c.logo ? <Avatar name={c.name} photo={c.logo} size={50} /> : <Glyph icon={Landmark} tone="wine" size={50} />}
                <div className="row__main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b>{c.name}</b>
                    {c.isActive === false && <span className="stat stat--bad">Inactive</span>}
                  </div>
                  <span>
                    {c.code ? `${c.code} · ` : ''}created {fmtDate(c.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="chips">
                  {c.city && (
                    <span className="chip">
                      <MapPin size={13} /> {c.city}
                    </span>
                  )}
                  {c.upiId && (
                    <span className="chip">
                      <Smartphone size={13} /> {c.upiId}
                    </span>
                  )}
                  <span className="chip chip--gold">{db.members.filter((m) => m.chapterId === c.id).length} members</span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
