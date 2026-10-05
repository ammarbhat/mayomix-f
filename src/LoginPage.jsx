import { useState } from 'react'
import { signIn, signUp } from './api.js'
import './LoginPage.css'

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const form = new FormData(event.currentTarget)
    const username = String(form.get('username') || '').trim()
    const password = form.get('password')
    try {
      if (isSigningUp) {
        if (password !== form.get('confirm-password')) throw new Error('Passwords do not match.')
        const genres = String(form.get('genres') || '')
          .split(',')
          .map((genre) => genre.trim())
          .filter(Boolean)
        if (genres.length === 0) throw new Error('Add at least one favorite genre.')
        await signUp({
          name: String(form.get('name')).trim(),
          username: String(username).trim(),
          email: String(form.get('email')).trim(),
          fav_genres: genres,
        }, password)
      }
      await signIn(username, password)
      window.location.assign('/profile')
    } catch (requestError) {
      setError(requestError.message || (isSigningUp ? 'Could not create your account.' : 'Could not sign in. Check the API and your login details.'))
    } finally {
      setSubmitting(false)
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
          <h1>{isSigningUp ? 'Create account' : 'Sign in'}</h1>
          <form className="login-form" onSubmit={handleSubmit}>
            {isSigningUp && <>
              <label htmlFor="login-name">Name</label>
              <input id="login-name" name="name" autoComplete="name" placeholder="Your name" required />
            </>}
            <label htmlFor="login-username">Username</label>
            <input id="login-username" name="username" autoComplete="username" placeholder="Username" required />
            {isSigningUp && <>
              <label className="password-title" htmlFor="login-email">Email</label>
              <input id="login-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
              <label className="password-title" htmlFor="login-genres">Favorite genres</label>
              <input id="login-genres" name="genres" placeholder="Indie, pop, jazz" aria-describedby="genres-hint" required />
              <span className="login-hint" id="genres-hint">Separate genres with commas.</span>
            </>}
            <label className="password-title" htmlFor="login-password">Password</label>
            <div className="password-field">
              <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isSigningUp ? 'new-password' : 'current-password'} placeholder="Password" required />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'HIDE' : 'SHOW'}</button>
            </div>
            {isSigningUp && <>
              <label className="password-title" htmlFor="confirm-password">Confirm password</label>
              <input id="confirm-password" name="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Confirm password" required />
            </>}
            <button className="login-submit" type="submit" disabled={submitting}>{submitting ? (isSigningUp ? 'Creating account...' : 'Signing in...') : (isSigningUp ? 'Create account' : 'Sign in')} <span aria-hidden="true">↗</span></button>
            {error && <p className="login-error" role="alert">{error}</p>}
          </form>
          <p className="login-switch">
            {isSigningUp ? 'Already have an account?' : 'New to MayoMix?'}{' '}
            <button type="button" onClick={() => { setIsSigningUp((current) => !current); setError('') }}>
              {isSigningUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
