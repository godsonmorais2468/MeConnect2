import { useState } from 'react'
import { ListChecks, Settings as SettingsIcon } from 'lucide-react'
import { PageHead, Sheet, Toggle } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { setDueList, useDB } from '../../lib/store'
import { useToast } from '../../lib/toast'
import type { DueListMode } from '../../lib/types'

const CHOICES: { value: DueListMode; label: string; hint: string }[] = [
  { value: 'default', label: 'Default - 21st of the month', hint: 'A member joins the Due List on the 21st of the month a payment request was sent, if it is still unpaid. A request sent on or after the 21st joins the day it is sent.' },
  { value: 'due_date', label: 'Due Date', hint: 'A member joins the Due List once the due date set on the payment request has passed.' },
]

/** The chapter's settings, changed by its head table. */
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
    <div className="page">
      <PageHead
        eyebrow={`${chapter.name} · ${member.designation}`}
        icon={SettingsIcon}
        tone="steel"
        title="Settings"
        subtitle="Settings for your chapter."
      />

      <Sheet icon={ListChecks} tone="gold" title="Chapter Dues" note={enabled ? 'On' : 'Off'}>
        <div className="form-stack">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '6px 2px' }}>
            <span style={{ fontWeight: 500, fontSize: '14.5px' }}>Chapter Dues</span>
            <Toggle checked={enabled} onChange={(on) => void save(on, mode)} label="Chapter Dues on or off" />
          </div>

          {enabled && (
            <div className="rchoices" role="radiogroup" aria-label="Chapter Dues">
              {CHOICES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === c.value}
                  className={`rchoice ${mode === c.value ? 'is-on' : ''}`}
                  onClick={() => void save(true, c.value)}
                  disabled={saving}
                >
                  <span className="rchoice__dot" aria-hidden />
                  {c.label}
                </button>
              ))}
            </div>
          )}
          {enabled && <p className="field__hint">{CHOICES.find((c) => c.value === mode)?.hint}</p>}
        </div>
      </Sheet>
    </div>
  )
}
