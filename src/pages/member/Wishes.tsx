import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Cake, ChevronDown, HeartHandshake, MessageCircle, PartyPopper } from 'lucide-react'
import { Avatar } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { fmtDate, firstName } from '../../lib/format'
import { useNow } from '../../lib/hooks'
import { useDB } from '../../lib/store'
import { ListSearch, NoMatch } from '../../components/ListSearch'
import { matches } from '../../lib/search'
import { wishesFor } from '../../lib/wishes'
import type { Wish } from '../../lib/wishes'

const KIND = {
  birthday: { label: 'Birthday', Icon: Cake },
  anniversary: { label: 'Anniversary', Icon: HeartHandshake },
} as const

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** A few pieces of confetti drifting in the banner. Pure decoration. */
function Confetti() {
  return (
    <span className="wx-confetti" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => (
        <i key={i} style={{ '--x': `${(i * 37 + 7) % 100}%`, '--y': `${(i * 53 + 11) % 86}%`, '--d': `${(i % 6) * 0.8}s`, '--s': `${6 + (i % 5) * 2}px`, '--k': i % 4 } as CSSProperties} />
      ))}
    </span>
  )
}

/** Someone to wish today: a greeting card with a big send button. */
function TodayCard({ wish }: { wish: Wish }) {
  const { member: m, kind } = wish
  const digits = m.mobile.replace(/\D/g, '')
  const first = firstName(m.name)
  const text =
    kind === 'birthday'
      ? `Happy Birthday, ${first}! Wishing you a wonderful year ahead.`
      : `Happy Anniversary, ${first}${m.profile.spouse ? ` and ${m.profile.spouse}` : ''}! Wishing you many more happy years together.`
  const { label, Icon } = KIND[kind]

  return (
    <li className={`wx-card wx-card--${kind === 'birthday' ? 'bday' : 'ann'}`}>
      <span className="wx-card__kind">
        <Icon size={14} /> {label}
      </span>
      <Link className="wx-card__who" to={`/directory/${m.id}`}>
        <span className="wx-card__photo">
          <Avatar name={m.name} photo={m.photo} size={88} />
        </span>
        <b>{m.name}</b>
        <small>{m.organisation || '—'}</small>
      </Link>
      <a className="wx-card__send" href={`https://wa.me/91${digits}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
        <MessageCircle size={17} /> Send wishes
      </a>
    </li>
  )
}

/** Someone coming up: one quiet row on the timeline. */
function UpRow({ wish }: { wish: Wish }) {
  const { member: m, kind } = wish
  const { label, Icon } = KIND[kind]
  return (
    <li>
      <Link className={`wx-row wx-row--${kind === 'birthday' ? 'bday' : 'ann'}`} to={`/directory/${m.id}`}>
        <Avatar name={m.name} photo={m.photo} size={44} />
        <span className="wx-row__who">
          <b>{m.name}</b>
          <small>
            {label} · {m.organisation || '—'}
          </small>
        </span>
        <i className="wx-row__ico">
          <Icon size={16} />
        </i>
      </Link>
    </li>
  )
}

export default function Wishes() {
  const { member, chapter } = useAuth()
  const db = useDB()
  const now = useNow(60_000)
  const [more, setMore] = useState(false)
  const [q, setQ] = useState('')

  if (!member) return null

  const all = wishesFor(db.members.filter((m) => m.chapterId === member.chapterId && matches(q, m.name, m.organisation, m.mobile)), now)
  const today = all.filter((w) => w.daysAway === 0)
  const upcoming = all.filter((w) => w.daysAway > 0)
  const todayBdays = today.filter((w) => w.kind === 'birthday')
  const todayAnns = today.filter((w) => w.kind === 'anniversary')

  /* upcoming wishes, a day at a time */
  const days: { key: string; wish: Wish; items: Wish[] }[] = []
  for (const w of upcoming) {
    const key = w.on.toDateString()
    const last = days[days.length - 1]
    if (last && last.key === key) last.items.push(w)
    else days.push({ key, wish: w, items: [w] })
  }

  return (
    <div className="page wx">
      <header className="wx-hero">
        <Confetti />
        <span className="wx-hero__icon">
          <PartyPopper size={26} />
        </span>
        <p className="wx-hero__date">{fmtDate(new Date(now).toISOString(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h1>Wishes</h1>
        <p className="wx-hero__sub">{chapter?.name ?? 'Your chapter'} celebrates together</p>
        <div className="wx-hero__stats">
          <span>
            <b>{todayBdays.length}</b> {todayBdays.length === 1 ? 'birthday' : 'birthdays'} today
          </span>
          <span>
            <b>{todayAnns.length}</b> {todayAnns.length === 1 ? 'anniversary' : 'anniversaries'} today
          </span>
          <span>
            <b>{upcoming.length}</b> coming up
          </span>
        </div>
      </header>

      <ListSearch value={q} onChange={setQ} placeholder="Search birthdays and anniversaries" />
      {q && all.length === 0 && <NoMatch query={q} />}

      <section className="wx-sect" aria-label="Today">
        <h2 className="wx-sect__title">
          Today <span>{today.length ? plural(today.length, 'celebration', 'celebrations') : ''}</span>
        </h2>
        {today.length ? (
          <ul className="wx-today">
            {today.map((w) => (
              <TodayCard key={`${w.kind}-${w.member.id}`} wish={w} />
            ))}
          </ul>
        ) : (
          <div className="wx-quiet">
            <PartyPopper size={28} />
            <b>Nothing to celebrate today</b>
            <span>No birthdays or anniversaries in your chapter. Check what is coming up.</span>
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="wx-sect" aria-label="Coming up">
          <button type="button" className={`wx-more${more ? ' is-open' : ''}`} aria-expanded={more} onClick={() => setMore((o) => !o)}>
            <span>
              <b>Coming up</b>
              <small>Next 30 days · {plural(upcoming.length, 'celebration', 'celebrations')}</small>
            </span>
            <ChevronDown size={18} />
          </button>

          {more && (
            <ol className="wx-line">
              {days.map((d) => (
                <li className="wx-day" key={d.key}>
                  <div className="wx-day__date">
                    <b>{fmtDate(d.wish.on.toISOString(), { day: 'numeric' })}</b>
                    <small>{fmtDate(d.wish.on.toISOString(), { weekday: 'short', month: 'short' })}</small>
                    <em>{d.wish.daysAway === 1 ? 'tomorrow' : `in ${d.wish.daysAway} days`}</em>
                  </div>
                  <ul className="wx-day__list">
                    {d.items.map((w) => (
                      <UpRow key={`${w.kind}-${w.member.id}`} wish={w} />
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  )
}
