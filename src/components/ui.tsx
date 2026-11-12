import { useId, useState } from 'react'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'
import { Camera } from 'lucide-react'
import { initials, toneFor } from '../lib/format'
import { readPhoto } from '../lib/photo'
import type { Tone } from '../lib/types'

type IconType = ComponentType<LucideProps>

const sizeVar = (size: number) => ({ '--size': `${size}px` }) as CSSProperties

/** Flat icon tile on a soft tint of its tone. */
export function Glyph({ icon: Icon, tone = 'red', size = 44 }: { icon: IconType; tone?: Tone; size?: number }) {
  return (
    <span className={`glyph t-${tone}`} style={sizeVar(size)} aria-hidden>
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.9} />
    </span>
  )
}

/** The ME-CONNECT mark: an M drawn as a line between people, with the meeting point in terracotta. */
export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <span className="brand-mark" style={sizeVar(size)}>
      <svg viewBox="0 0 64 64" role="img" aria-label="ME-CONNECT">
        <rect width="64" height="64" rx="12" fill="#2563EB" />
        <path d="M16 46V20l16 18 16-18v26" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="32" cy="38" r="6.5" fill="#FBBF24" />
      </svg>
    </span>
  )
}

/** A member's photo, or their initials on a tinted circle. */
export function Avatar({ name, photo, size = 40 }: { name: string; photo?: string; size?: number }) {
  if (photo) {
    return <img className="avatar-img" src={photo} alt="" decoding="async" loading="lazy" style={{ width: size, height: size }} />
  }
  return (
    <span className={`glyph glyph--avatar t-${toneFor(name)}`} style={sizeVar(size)} aria-hidden>
      <span className="glyph__txt">{initials(name)}</span>
    </span>
  )
}

export function PageHead({
  eyebrow,
  title,
  subtitle,
  actions,
  icon,
  tone = 'red',
}: {
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  icon?: IconType
  tone?: Tone
}) {
  return (
    <header className="phead">
      <div>
        {eyebrow && (
          <div className="phead__chip">
            {icon && <Glyph icon={icon} tone={tone} size={26} />}
            {eyebrow}
          </div>
        )}
        <h1>{title}</h1>
        {subtitle && <p className="phead__sub">{subtitle}</p>}
      </div>
      {actions && <div className="phead__actions">{actions}</div>}
    </header>
  )
}

/** A card with a heading. */
export function Sheet({ icon, tone = 'red', title, note, children, className }: { icon?: IconType; tone?: Tone; title: ReactNode; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className ? `sheet ${className}` : 'sheet'}>
      <div className="sheet__head">
        {icon && <Glyph icon={icon} tone={tone} size={40} />}
        <div>
          <h2>{title}</h2>
          {note && <p>{note}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export interface StripItem {
  icon: IconType
  tone: Tone
  label: string
  value: ReactNode
}

/** One card holding a few headline numbers. */
export function StatStrip({ items }: { items: StripItem[] }) {
  return (
    <div className="strip">
      {items.map((i) => (
        <div className="strip__item" key={i.label}>
          <Glyph icon={i.icon} tone={i.tone} size={46} />
          <div>
            <div className="strip__label">{i.label}</div>
            <div className="strip__value">{i.value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Circular progress. */
export function Ring({ pct, size = 150, label, stroke = 11 }: { pct: number; size?: number; label?: string; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  /* a complete profile turns green */
  const done = pct >= 100
  return (
    <div className={`ring ${done ? 'is-done' : ''}`} style={{ width: size, height: size }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring__arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? 'var(--ok)' : 'var(--brand)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className="ring__text">
        <div className="ring__n">{pct}%</div>
        {label && <div className="ring__l">{label}</div>}
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

/* ---------- form pieces ---------- */

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className={`field ${error ? 'field--invalid' : ''}`}>
      <span className="field__label">
        {label}
        {required && <span className="req">*</span>}
      </span>
      {hint && <span className="field__hint">{hint}</span>}
      {children}
      {error && <span className="field__error">{error}</span>}
    </label>
  )
}

/** Like Field, for a group of buttons rather than one input. */
export function FieldGroup({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className={`field ${error ? 'field--invalid' : ''}`} role="group" aria-label={label}>
      <span className="field__label">
        {label}
        {required && <span className="req">*</span>}
      </span>
      {children}
      {error && <span className="field__error">{error}</span>}
    </div>
  )
}

/** 4-digit PIN with the "Show Password" checkbox used in LTRT. */
export function PinField({
  label = 'Password',
  value,
  onChange,
  error,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  const [show, setShow] = useState(false)
  const id = useId()
  return (
    <div className={`field ${error ? 'field--invalid' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        <span className="req">*</span>
      </label>
      <span className="field__hint">Password must be a 4-digit number</span>
      <input
        id={id}
        className="field__control"
        type={show ? 'text' : 'password'}
        inputMode="numeric"
        autoComplete="new-password"
        placeholder="Enter a new 4-digit pin"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      />
      <label className="check">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show Password
      </label>
      {error && <span className="field__error">{error}</span>}
    </div>
  )
}

/** Photo picker (max 2 MB). Stores a small data URL. */
export function PhotoField({
  label = 'Photo (Max Size 2MB)',
  value,
  onChange,
  edge,
  fileName,
}: {
  label?: string
  value: string
  /** Called with the picture and, when one was just chosen, the name of its file. */
  onChange: (dataUrl: string, fileName?: string) => void
  edge?: number
  /** The name of the file the saved picture came from, shown until another is chosen. */
  fileName?: string
}) {
  const [error, setError] = useState('')
  /* the chosen file's name belongs to the picture it produced: once the form clears the picture (after saving, or Remove photo), the name goes with it */
  const [picked, setPicked] = useState({ name: '', url: '' })
  const name = value && picked.url === value ? picked.name : ''

  async function pick(file: File | undefined) {
    if (!file) return
    try {
      const url = await readPhoto(file, edge)
      setError('')
      setPicked({ name: file.name, url })
      onChange(url, file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That image could not be read.')
    }
  }

  return (
    <div className={`field ${error ? 'field--invalid' : ''}`}>
      <span className="field__label">{label}</span>
      {value && <img className="photo__preview" src={value} alt="Photo preview" />}
      <label className="filebox">
        <span className="filebox__btn">
          <Camera size={15} /> {value ? 'Change photo' : 'Choose File'}
        </span>
        <span className="filebox__name">{name || (value ? fileName || 'Current photo' : 'No file chosen')}</span>
        {/* a new input each time the picture is cleared, so the browser forgets the old file and the same one can be chosen again */}
        <input key={value ? 'filled' : 'empty'} type="file" accept="image/*" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      {value && (
        <button
          type="button"
          className="link-btn"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => onChange('')}
        >
          Remove photo
        </button>
      )}
      {error && <span className="field__error">{error}</span>}
    </div>
  )
}
