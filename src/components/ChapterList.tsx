import { Landmark } from 'lucide-react'
import { Glyph } from './ui'
import type { Membership } from '../lib/types'

/** The chapters a person belongs to, one button each: chapter, region and the designation they hold there. */
export default function ChapterList({ memberships, currentId, busy, onPick }: { memberships: Membership[]; currentId?: string; busy?: boolean; onPick: (memberId: string) => void }) {
  return (
    <ul className="cpick">
      {memberships.map((m) => (
        <li key={m.memberId}>
          <button type="button" className={`cpick__row ${m.memberId === currentId ? 'is-on' : ''}`} disabled={busy} onClick={() => onPick(m.memberId)}>
            <Glyph icon={Landmark} tone={m.memberId === currentId ? 'green' : 'red'} size={42} />
            <span className="cpick__name">
              <b>{m.chapterName}</b>
              <small>
                {m.regionName} · {m.designation}
              </small>
            </span>
            {m.memberId === currentId && <span className="stat stat--ok">Current</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}
