import { useEffect, useRef, useState } from 'react'
import { signIn, signUp } from './api.js'
import { GENRES } from './genreOptions.js'
import './LoginPage.css'

function LoginPage() {
  const [accountDeletedNotice, setAccountDeletedNotice] = useState(() => {
    const pending = sessionStorage.getItem('mayomix.account_deleted_notice') === '1'
    if (pending) sessionStorage.removeItem('mayomix.account_deleted_notice')
    return pending
  })
  const accountDeletedDialogRef = useRef(null)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [genres, setGenres] = useState([])
  const [genreMenu, setGenreMenu] = useState(false)

  useEffect(() => {
    const dialog = accountDeletedDialogRef.current
    if (accountDeletedNotice && dialog && !dialog.open) dialog.showModal()
    if (!accountDeletedNotice && dialog?.open) dialog.close()
  }, [accountDeletedNotice])

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

  function addGenre(genre) {
    if (genres.length >= 3 || genres.includes(genre)) return
    setGenres((current) => [...current, genre])
    setGenreMenu(false)
  }

  return (
    <main className="login-page">
      <section className="login-art" aria-label="mayomix">
        <img className="login-record" src="/images/vinyl-photo.jpg" alt="Vinyl record" />
        <div className="login-art-shade" />
        <a className="login-brand" href="/" aria-label="MayoMix home">
          <img src="/images/mayomix-logo.png" alt="" />
          <span>mayomix</span>
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
              <span className="password-title login-genres-label" id="login-genres-label">Favorite genres</span>
              <div className="login-genre-picker">
                <div className="login-selected-genres" role="list" aria-label="Selected favorite genres">
                  {genres.map((genre) => <span className="login-selected-genre" role="listitem" key={genre}>{genre}<button type="button" onClick={() => setGenres((current) => current.filter((item) => item !== genre))} aria-label={`Remove ${genre}`}>×</button></span>)}
                  {!genres.length && <span className="login-genre-empty">Choose up to three genres</span>}
                </div>
                <div className="login-genre-trigger-wrap">
                  <button className="login-genre-trigger" type="button" aria-labelledby="login-genres-label" aria-describedby="genres-hint" aria-expanded={genreMenu} onClick={() => setGenreMenu((open) => !open)}>Select Genres</button>
                  {genreMenu && <div className="login-genre-menu" role="group" aria-label="Available genres">{GENRES.filter((genre) => !genres.includes(genre)).map((genre) => <button type="button" key={genre} disabled={genres.length >= 3} onClick={() => addGenre(genre)}>{genre}</button>)}</div>}
                </div>
                <span className="login-hint" id="genres-hint">Select at least one genre.</span>
              </div>
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
            <button type="button" onClick={() => { setIsSigningUp((current) => !current); setError(''); setGenres([]); setGenreMenu(false) }}>
              {isSigningUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </section>
      <dialog className="login-account-deleted-dialog" ref={accountDeletedDialogRef} aria-label="Account deleted" onClose={() => setAccountDeletedNotice(false)}>
        <p>Your account has been deleted and you were logged out.</p>
        <button type="button" onClick={() => setAccountDeletedNotice(false)}>Okay</button>
      </dialog>
    </main>
  )
}

export default LoginPage
