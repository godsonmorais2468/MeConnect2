import { useState } from 'react'
import type { FormEvent } from 'react'
import { BadgeCheck, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { Field, Glyph, PageHead, Sheet, StatStrip, Toggle } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { designationsOf } from '../../lib/designations'
import { createDesignation, customiseDesignation, deleteDesignation, removeDesignationForRegion, updateDesignation, useDB } from '../../lib/store'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import type { Designation } from '../../lib/types'

/* Extra permissions for a designation. For now they are only ticked on the form; nothing is saved or checked yet. */
const EXTRA_FLAGS = ['Approval', 'Attendance', 'Visitor Host', 'Event'] as const

export default function Designations() {
  const { region, role, member, chapter } = useAuth()
  /* The super admin sets the defaults every region gets. A region admin changes them for their region. A head table member
     manages the designations of their own chapter only; the ones from the region and the defaults are locked for them. */
  const isSuper = role === 'super_admin'
  const isChapter = role === 'member'
  const regionId = region?.id ?? member?.regionId ?? ''
  const chapterId = isChapter ? (member?.chapterId ?? '') : ''
  const db = useDB()
  const [q, setQ] = useState('')
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [headTable, setHeadTable] = useState(false)
  /* a person with this designation can also be in other chapters: signing in to each (login), or only listed there (add only). Never both. */
  const [multiLogin, setMultiLogin] = useState(false)
  const [multiAddOnly, setMultiAddOnly] = useState(false)
  const [extras, setExtras] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!isSuper && !region && !member) return null
  const list = isSuper ? db.designations.filter((d) => !d.regionId) : designationsOf(db, regionId, chapterId)
  const shown = list.filter((d) => matches(q, d.name, d.description))
  const inUse = (d: Designation) => db.members.filter((m) => (isSuper || (isChapter ? m.chapterId === chapterId : m.regionId === regionId)) && m.designation === d.name).length

  function reset() {
    setEditing(null)
    setName('')
    setDescription('')
    setHeadTable(false)
    setMultiLogin(false)
    setMultiAddOnly(false)
    setExtras([])
    setIsActive(true)
    setErrors({})
  }

  function startEdit(d: Designation) {
    setEditing(d.id)
    setName(d.name)
    setDescription(d.description)
    setHeadTable(d.isHeadTable)
    setMultiLogin(Boolean(d.multiChapterLogin))
    setMultiAddOnly(Boolean(d.multiChapterAddOnly))
    setExtras(d.permissions || [])
    setIsActive(d.isActive)
    setErrors({})
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setErrors({ name: 'Enter the designation name.' })
    const input = { name, description, isHeadTable: headTable, multiChapterLogin: multiLogin, multiChapterAddOnly: multiAddOnly, permissions: extras, isActive }
    /* A region admin changing a default saves the region's own version; the default itself stays as the super admin set it. */
    const target = editing ? db.designations.find((d) => d.id === editing) : undefined
    const res = !editing
      ? await createDesignation(regionId, input, chapterId)
      : !isSuper && target && (isChapter ? !target.chapterId : !target.regionId)
        ? await customiseDesignation(editing, regionId, input, chapterId)
        : await updateDesignation(editing, input)
    if (res.error) return setErrors({ [res.field ?? 'form']: res.error })
    toast(`Designation ${name.trim()} ${editing ? 'updated' : 'created'}`)
    reset()
  }

  async function remove(d: Designation) {
    /* For a region admin a default (or their version of one) is removed from their region only. */
    const own = isChapter ? d.chapterId : d.regionId
    const fromRegionOnly = !isSuper && (!own || Boolean(d.sourceId))
    if (!(await confirm({ title: 'Delete designation?', message: fromRegionOnly ? `"${d.name}" will be removed from your ${isChapter ? 'chapter. Other chapters keep it' : 'region. Other regions keep it'}.` : `"${d.name}" will be removed. This cannot be undone.` }))) return
    const res = fromRegionOnly ? await removeDesignationForRegion(d.id, regionId, chapterId) : await deleteDesignation(d.id)
    if (res.error) return toast(res.error, 'info')
    toast(`Designation "${d.name}" deleted`)
    if (editing === d.id) reset()
  }

  return (
    <div className="page">
      <PageHead
        eyebrow={isSuper ? 'Super Admin · Default for all regions' : isChapter ? `${chapter?.name ?? ''} · ${member?.designation ?? ''}` : `Region Admin · ${region?.name ?? ''}`}
        icon={BadgeCheck}
        tone="steel"
        title="Designation"
        subtitle={
          isSuper
            ? 'The roles every region gets, including regions added later. Regions can add their own on top.'
            : isChapter
              ? 'The roles members can hold in your chapter. Ones from your region and the defaults are shared; changing or removing one only affects your chapter.'
              : 'The roles members can hold in your region. Defaults from the super admin are shared; changing or removing one only affects your region.'
        }
      />

      <StatStrip
        items={[
          { icon: BadgeCheck, tone: 'steel', label: 'Designations', value: list.length },
          { icon: BadgeCheck, tone: 'green', label: 'Active', value: list.filter((d) => d.isActive).length },
        ]}
      />

      <div className="duo">
        <Sheet icon={editing ? Pencil : Plus} tone="steel" title={editing ? 'Edit designation' : 'Create designation'} note={isSuper ? 'All regions' : isChapter ? chapter?.name : region?.name}>
          <form className="form-stack" onSubmit={submit} noValidate>
            <Field label="Name" required error={errors.name}>
              <input className="field__control" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </Field>
            <Field label="Description">
              <textarea className="field__control" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
            </Field>
            <div className="checks">
              <label className="check">
                <input type="checkbox" checked={headTable} onChange={(e) => setHeadTable(e.target.checked)} /> Head Table
              </label>
              <label className="check">
                <input type="checkbox" checked={multiLogin} onChange={(e) => { setMultiLogin(e.target.checked); if (e.target.checked) setMultiAddOnly(false) }} /> Multiple Chapter Login
              </label>
              <label className="check">
                <input type="checkbox" checked={multiAddOnly} onChange={(e) => { setMultiAddOnly(e.target.checked); if (e.target.checked) setMultiLogin(false) }} /> Multiple Chapter Add Only
              </label>
              {EXTRA_FLAGS.map((flag) => (
                <label className="check" key={flag}>
                  <input type="checkbox" checked={extras.includes(flag)} onChange={(e) => setExtras((cur) => (e.target.checked ? [...cur, flag] : cur.filter((x) => x !== flag)))} /> {flag}
                </label>
              ))}
            </div>
            <div className="toggle-row">
              <Toggle checked={isActive} onChange={setIsActive} label="Designation active or deactive" />
              <span>Active/Deactive</span>
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
            All designations <span>{list.length}</span>
          </h2>
          <ListSearch value={q} onChange={setQ} placeholder="Search designations" />
          {q && shown.length === 0 && list.length > 0 && <NoMatch query={q} />}
          {list.length === 0 ? (
            <div className="empty">
              <b>No designations yet.</b>
              Create the first one to use it in the sign-up form.
            </div>
          ) : (
            shown.map((d) => {
              const used = inUse(d)
              return (
                <article key={d.id} className="row row--tags" style={{ opacity: d.isActive ? 1 : 0.7 }}>
                  <div className="row__acts">
                    <button type="button" className="btn btn--ghost btn--sm" title="Edit designation" aria-label={`Edit ${d.name}`} onClick={() => startEdit(d)} style={{ padding: '6px 8px' }}>
                      <Pencil size={15} />
                    </button>
                    {used > 0 ? (
                      <button type="button" className="btn btn--ghost btn--sm" disabled title={`Locked: ${used} member(s) hold this designation. Mark it inactive instead.`} style={{ padding: '6px 8px', color: 'var(--ink-mute)', opacity: 0.45, cursor: 'not-allowed' }}>
                        <Lock size={14} />
                      </button>
                    ) : (
                      <button type="button" className="btn btn--ghost btn--sm" title="Delete designation" aria-label={`Delete ${d.name}`} onClick={() => remove(d)} style={{ padding: '6px 8px', color: '#ef4444' }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <Glyph icon={BadgeCheck} tone="steel" size={50} />
                  <div className="row__main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b>{d.name}</b>
                      {!d.isActive && <span className="stat stat--bad">Inactive</span>}
                    </div>
                    <span>{d.description || 'No description'}</span>
                  </div>
                  <div className="chips">
                    {!isSuper && !d.chapterId && (isChapter || !d.regionId) && <span className="chip">{d.regionId ? 'Region' : 'Default'}</span>}
                    {d.isHeadTable && <span className="chip chip--gold">Head Table</span>}
                    {d.multiChapterLogin && <span className="chip">Multiple Chapter Login</span>}
                    {d.multiChapterAddOnly && <span className="chip">Multiple Chapter Add Only</span>}
                    {d.permissions?.map((p) => (
                      <span key={p} className="chip">{p}</span>
                    ))}
                    <span className="chip">{used} {used === 1 ? 'member' : 'members'}</span>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
