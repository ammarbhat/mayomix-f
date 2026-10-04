import { useState } from 'react'
import './App.css'

function App() {
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setMessage('Sign-in is ready to connect to the Mayo-Mix API.')
  }

  return (
    <main className="login-page">
      <section className="visual-panel" aria-label="Mayo-Mix">
        <img className="record-photo" src="/images/vinyl-photo.jpg" alt="Vinyl record" />
        <div className="visual-wash" />
        <header className="brand brand-light">
          <img src="/images/mayomix-logo.png" alt="" className="brand-mark" />
          <span>mayo<span className="brand-accent">mix</span></span>
        </header>
      </section>

      <section className="form-panel">
        <header className="mobile-brand brand">
          <img src="/images/mayomix-logo.png" alt="" className="brand-mark" />
          <span>mayo<span className="brand-accent">mix</span></span>
        </header>
        <div className="login-card">
          <h1>Sign in</h1>
          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email or username</label>
            <input id="email" name="email" type="text" autoComplete="username" placeholder="Email or username" required />
            <div className="password-label-row">
              <label htmlFor="password">Password</label>
              <a href="#forgot-password" onClick={(event) => { event.preventDefault(); setMessage('Password reset is not connected yet.') }}>Forgot password?</a>
            </div>
            <div className="password-wrap">
              <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" required />
              <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'HIDE' : 'SHOW'}</button>
            </div>
            <button className="submit-button" type="submit">Sign in <span aria-hidden="true">↗</span></button>
            {message && <p className="form-message" role="status">{message}</p>}
          </form>
          <p className="signup-prompt">New here? <a href="#create-account" onClick={(event) => { event.preventDefault(); setMessage('Account creation is not connected yet.') }}>Create an account</a></p>
        </div>
      </section>
    </main>
  )
}

export default App
