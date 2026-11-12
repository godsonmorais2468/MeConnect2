/** Quiet rings behind the sign-in card. */
export default function AuthArt() {
  return (
    <aside className="login__art" aria-hidden>
      <span className="login__ring login__ring--a" />
      <span className="login__ring login__ring--b" />
      <span className="login__ring login__ring--c" />
    </aside>
  )
}
