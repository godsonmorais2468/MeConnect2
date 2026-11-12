import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeftRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { switchChapter, useMemberships } from '../lib/store'
import { useToast } from '../lib/toast'
import ChapterList from './ChapterList'

/** Move to another chapter the person belongs to, with no PIN: Home, Dues and Attendance then follow that chapter. */
export default function SwitchChapterDialog({ currentId, onClose }: { currentId: string; onClose: () => void }) {
  const memberships = useMemberships()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function pick(memberId: string) {
    if (busy) return
    if (memberId === currentId) return onClose()
    setBusy(true)
    setError('')
    const res = await switchChapter(memberId)
    setBusy(false)
    if (res.error) return setError(res.error)
    toast(`Switched to ${memberships.find((m) => m.memberId === memberId)?.chapterName ?? 'the chapter'}`)
    onClose()
    navigate('/')
  }

  return createPortal(
    <div className="confirm" onMouseDown={onClose}>
      <div className="confirm__card cpick__card" role="dialog" aria-modal="true" aria-labelledby="switch-title" onMouseDown={(e) => e.stopPropagation()}>
        <span className="confirm__ico">
          <ArrowLeftRight size={22} />
        </span>
        <h2 id="switch-title">Switch chapter</h2>
        <p>You are a member of more than one chapter. Choose the one to open.</p>
        <ChapterList memberships={memberships} currentId={currentId} busy={busy} onPick={pick} />
        {error && <div className="form-error">{error}</div>}
        <div className="confirm__acts">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
