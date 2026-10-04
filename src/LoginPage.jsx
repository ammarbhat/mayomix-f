import { useState } from 'react'
import { signIn } from './api.js'
import './LoginPage.css'

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSigningIn(true)
    const form = new FormData(event.currentTarget)
    try {
      await signIn(form.get('username'), form.get('password'))
      window.location.assign('/profile')
    } catch (requestError) {
      setError(requestError.message || 'Could not sign in. Check the API and your login details.')
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-art" aria-label="MayoMix">
        <img className="login-record" src="/images/vinyl-photo.jpg" alt="Vinyl record" />
        <div className="login-art-shade" />
        <a className="login-brand" href="/" aria-label="MayoMix home">
          <img src="/images/mayomix-logo.png" alt="" />
          <span>MayoMix</span>
        </a>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <h1>Sign in</h1>
          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="login-username">Username</label>
            <input id="login-username" name="username" autoComplete="username" placeholder="Username" required />
            <label className="password-title" htmlFor="login-password">Password</label>
            <div className="password-field">
              <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" required />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'HIDE' : 'SHOW'}</button>
            </div>
            <button className="login-submit" type="submit" disabled={signingIn}>{signingIn ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">↗</span></button>
            {error && <p className="login-error" role="alert">{error}</p>}
          </form>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
