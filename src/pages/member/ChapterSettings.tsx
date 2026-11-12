import { useState } from 'react'
import { CalendarDays, Check, ListChecks, Settings as SettingsIcon } from 'lucide-react'
import CpHero from '../../components/CpHero'
import { Toggle } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { setDueList, useDB } from '../../lib/store'
import { useToast } from '../../lib/toast'
import type { DueListMode } from '../../lib/types'

const CHOICES: { value: DueListMode; label: string; hint: string }[] = [
  { value: 'default', label: 'Default - 21st of the month', hint: 'A member joins the Due List on the 21st of the month a payment request was sent, if it is still unpaid. A request sent on or after the 21st joins the day it is sent.' },
  { value: 'due_date', label: 'Due Date', hint: 'A member joins the Due List once the due date set on the payment request has passed.' },
]

/** The chapter's settings, changed by its head table. One switch, and a choice that opens under it. */
export default function ChapterSettings() {
  const { member, chapter } = useAuth()
  const db = useDB()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  if (!member || !chapter) return null

  /* read from the saved chapter, so the screen always shows what the server has */
  const current = db.chapters.find((c) => c.id === chapter.id)
  const enabled = current?.dueListEnabled ?? false
  const mode = current?.dueListMode ?? 'default'

  async function save(nextEnabled: boolean, nextMode: DueListMode) {
    if (saving || !chapter) return
    setSaving(true)
    const res = await setDueList(chapter.id, nextEnabled, nextMode)
    setSaving(false)
    if (res.error) toast(res.error, 'info')
  }

  return (
    <div className="page st">
      <CpHero className="st-hero" icon={SettingsIcon} eyebrow={`${chapter.name} · ${member.designation}`} title="Settings" sub="Settings for your chapter." />

      <section className={`st-card${enabled ? ' is-on' : ''}`}>
        <div className="st-card__top">
          <span className="st-card__ico">
            <ListChecks size={24} />
          </span>
          <div className="st-card__txt">
            <h2>Chapter Dues</h2>
            <p>{enabled ? 'Members with unpaid requests appear on the Due List.' : 'The Due List is hidden from members.'}</p>
          </div>
          <Toggle checked={enabled} onChange={(on) => void save(on, mode)} label="Chapter Dues on or off" />
        </div>

        <div className="st-reveal" data-open={enabled} inert={!enabled}>
          <div className="st-reveal__in">
            <p className="st-label">
              <CalendarDays size={15} /> When does a member join the Due List?
            </p>
            <div className="st-choices" role="radiogroup" aria-label="Chapter Dues">
              {CHOICES.map((c) => (
                <button key={c.value} type="button" role="radio" aria-checked={mode === c.value} className={`st-choice${mode === c.value ? ' is-on' : ''}`} onClick={() => void save(true, c.value)} disabled={saving}>
                  <span className="st-choice__tick" aria-hidden>
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <b>{c.label}</b>
                  <small>{c.hint}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
