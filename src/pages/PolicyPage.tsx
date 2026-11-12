import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { BrandMark } from '../components/ui'
import { POLICIES } from '../data/policies'
import type { PolicyKey } from '../data/policies'

/** One of the policies shown from the sign-in screen: Terms & Conditions, Privacy Policy or Refund Policy. No sign in needed. */
export default function PolicyPage({ policy }: { policy: PolicyKey }) {
  const { title, sections } = POLICIES[policy]
  return (
    <>
      <div className="policy">
        <article className="policy__card">
          <header className="policy__head">
            <BrandMark size={52} />
            <div>
              <span>ME-CONNECT</span>
              <h1>{title}</h1>
            </div>
          </header>

          {sections.map((s) => (
            <section key={s.title} className="policy__sec">
              <h2>{s.title}</h2>
              {s.text?.map((t) => (
                <p key={t}>{t}</p>
              ))}
              {s.items && (
                <ul>
                  {s.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <Link className="btn btn--line policy__back" to="/login">
            <ArrowLeft size={16} /> Back to login
          </Link>
        </article>
      </div>
    </>
  )
}
