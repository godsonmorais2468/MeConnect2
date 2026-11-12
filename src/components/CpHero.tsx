import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** The banner at the top of a Control Panel page. Each page gives it its own modifier class and its own `aside`. */
export default function CpHero({
  icon: Icon,
  eyebrow,
  title,
  sub,
  className = '',
  back,
  children,
}: {
  icon: LucideIcon
  eyebrow?: string
  title: string
  sub?: string
  className?: string
  /** a way back to the page this one belongs to */
  back?: { to: string; label: string }
  /** the right-hand side of the banner: numbers, a ring, buttons */
  children?: ReactNode
}) {
  return (
    <header className={`cx-hero ${className}`}>
      <div className="cx-hero__text">
        {back && (
          <Link to={back.to} className="cx-hero__back">
            <ArrowLeft size={14} /> {back.label}
          </Link>
        )}
        <span className="cx-hero__icon">
          <Icon size={24} />
        </span>
        {eyebrow && <p className="cx-hero__eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {sub && <p className="cx-hero__sub">{sub}</p>}
      </div>
      {children && <div className="cx-hero__aside">{children}</div>}
    </header>
  )
}

/** A few headline numbers, glass tiles in a banner. */
export function Nums({ items }: { items: [value: ReactNode, label: string][] }) {
  return (
    <div className="cx-nums">
      {items.map(([v, l]) => (
        <span key={l}>
          <b>{v}</b>
          <small>{l}</small>
        </span>
      ))}
    </div>
  )
}

/** The banner button that folds a form open and shut. */
export function NewButton({ open, onClick, label, controls }: { open: boolean; onClick: () => void; label: string; controls: string }) {
  return (
    <button type="button" className={`cp-new${open ? ' is-open' : ''}`} onClick={onClick} aria-expanded={open} aria-controls={controls}>
      {open ? <X size={17} /> : <Plus size={17} />} {open ? 'Close' : label}
    </button>
  )
}

/** A form that folds open under the banner. Shut, its fields cannot be reached. */
export function Fold({ id, open, label, children }: { id: string; open: boolean; label: string; children: ReactNode }) {
  return (
    <section className="cp-fold" id={id} data-open={open} inert={!open} aria-label={label}>
      <div className="cp-fold__in">{children}</div>
    </section>
  )
}
