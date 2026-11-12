import { BrandMark } from './ui'

/** The left half of the sign-in card, drawn like a member pass: the mark, the tagline, a contact chip and a code strip. */
export default function LoginPass() {
  return (
    <aside className="pass" aria-hidden>
      <div className="pass__brand">
        <BrandMark size={36} />
        <span>ME-CONNECT</span>
      </div>
      <p className="pass__tag">
        <b>Connect.</b> <b>Collaborate.</b> <b>Grow.</b>
      </p>
      <div className="pass__foot">
        <span className="pass__chip" />
        <span className="pass__code" />
      </div>
    </aside>
  )
}
