import { Check } from 'lucide-react'
import { tally } from '../lib/polls'
import type { Member, Poll, Vote } from '../lib/types'

/** Bars showing how many members picked each option. */
export default function PollResults({ poll, votes, mine = [], members }: { poll: Poll; votes: Vote[]; mine?: string[]; members?: Member[] }) {
  const { counts, voters } = tally(poll, votes)
  return (
    <ul className="res">
      {poll.options.map((o) => {
        const n = counts[o.id] ?? 0
        const pct = voters ? Math.round((n / voters) * 100) : 0
        const who = members
          ? votes
              .filter((v) => v.pollId === poll.id && v.optionIds.includes(o.id))
              .map((v) => members.find((m) => m.id === v.memberId)?.name)
              .filter((name): name is string => !!name)
          : []
        return (
          <li key={o.id} className={mine.includes(o.id) ? 'is-mine' : ''}>
            <div className="res__top">
              <span>
                {o.text}
                {mine.includes(o.id) && (
                  <em>
                    <Check size={13} /> Your answer
                  </em>
                )}
              </span>
              <b>
                {n} · {pct}%
              </b>
            </div>
            <div className="bar">
              <i style={{ width: `${pct}%` }} />
            </div>
            {members && who.length > 0 && (
              <div className="res__who">
                {who.map((name) => (
                  <span className="chip" key={name}>
                    {name}
                  </span>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
