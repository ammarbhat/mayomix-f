import { useEffect, useMemo, useState } from 'react'
import AppHeader from './AppHeader.jsx'
import EditProfilePage from './EditProfilePage.jsx'
import { apiRequest, changePassword, clearStoredToken, getStoredToken } from './api.js'
import './SettingsPage.css'

const accountSections = [
  { id: 'account', label: 'Account Information' },
  { id: 'edit-profile', label: 'Edit Profile' },
  { id: 'change-password', label: 'Change Password' },
  { id: 'change-username', label: 'Change Username' },
  { id: 'delete-account', label: 'Delete Account' },
]

const appSections = [
  { id: 'developer', label: 'From The Developer' },
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'terms', label: 'Terms Of Service' },
  { id: 'bug', label: 'Report A Bug' },
  { id: 'github', label: 'Github' },
  { id: 'feedback', label: 'Feedback' },
]

function selectedSection() {
  const slug = window.location.pathname.replace(/\/$/, '').split('/').pop()
  return [...accountSections, ...appSections].some((section) => section.id === slug) ? slug : 'account'
}

function formatJoinedDate(value) {
  if (!value) return '—'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value)
}

function AccountInformation({ token }) {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiRequest('/users/me', { token, cache: false }).then((profile) => {
      if (!cancelled) setUser(profile)
    }).catch((requestError) => {
      if (cancelled) return
      if (requestError.status === 401) {
        clearStoredToken()
        window.location.replace('/login')
        return
      }
      setError(requestError.message || 'Account information could not be loaded.')
    })
    return () => { cancelled = true }
  }, [token])

  const rows = [
    ['Name', user?.name],
    ['Username', user?.username ? `@${user.username}` : ''],
    ['Bio', user?.bio],
    ['Email', user?.email],
    ['Date Joined', formatJoinedDate(user?.create_date)],
  ]

  return <div className="settings-account-wrap" aria-busy={!user && !error}>
    {error && <p className="settings-load-error" role="alert">{error}</p>}
    {!user && !error && <p className="settings-loading" role="status">Loading account information…</p>}
    {user && <dl className="settings-account-table">
      {rows.map(([label, value]) => <div className="settings-account-row" key={label}>
        <dt>{label}</dt><dd>{value || (label === 'Bio' ? '—' : '')}</dd>
      </div>)}
    </dl>}
  </div>
}

function ChangePassword({ token }) {
  const [values, setValues] = useState({ password: '', newPassword: '', confirmPassword: '' })
  const [feedback, setFeedback] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function update(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
    setFeedback(null)
  }

  async function submit(event) {
    event.preventDefault()
    if (submitting) return
    setFeedback(null)
    if (values.newPassword !== values.confirmPassword) {
      setFeedback({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setSubmitting(true)
    try {
      await changePassword(values.password, values.newPassword, token)
      setValues({ password: '', newPassword: '', confirmPassword: '' })
      setFeedback({ type: 'success', text: 'Password changed successfully' })
    } catch (error) {
      if (error.status === 401 && /incorrect password/i.test(error.message || '')) setFeedback({ type: 'error', text: 'Password Incorrect!' })
      else if (error.status === 409) setFeedback({ type: 'error', text: 'New password cannot be same as old password.' })
      else if (error.status === 401 || /unauthorized|unauthenticated|credentials/i.test(error.message || '')) {
        clearStoredToken()
        window.location.replace('/login')
      } else setFeedback({ type: 'error', text: error.message || 'Password could not be changed. Try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return <form className="settings-password-form" onSubmit={submit} noValidate>
    <div className="settings-password-fields">
      <label htmlFor="settings-old-password">Old Password</label>
      <input id="settings-old-password" name="password" type="password" autoComplete="current-password" value={values.password} onChange={update} required />
      <label htmlFor="settings-new-password">New Password</label>
      <input id="settings-new-password" name="newPassword" type="password" autoComplete="new-password" value={values.newPassword} onChange={update} required />
      <label htmlFor="settings-confirm-password">Confirm New Password</label>
      <input id="settings-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={update} required />
    </div>
    <button className="settings-password-submit" type="submit" disabled={submitting || !values.password || !values.newPassword || !values.confirmPassword}>
      {submitting ? 'Saving…' : 'Confirm Change'}
    </button>
    {feedback && <p className={`settings-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
      <img src={feedback.type === 'success' ? '/images/connection-check.png' : '/images/connection-decline.png'} alt="" />
      <span>{feedback.text}</span>
    </p>}
  </form>
}

function SettingsPage() {
  const token = getStoredToken()
  const [active, setActive] = useState(selectedSection)
  const title = useMemo(() => [...accountSections, ...appSections].find((section) => section.id === active)?.label || 'Account Information', [active])

  useEffect(() => {
    if (!token) window.location.replace('/login')
  }, [token])

  useEffect(() => {
    function syncSection() { setActive(selectedSection()) }
    window.addEventListener('popstate', syncSection)
    return () => window.removeEventListener('popstate', syncSection)
  }, [])

  function logOut() {
    clearStoredToken()
    window.location.replace('/login')
  }

  function sectionLink(section) {
    return <a key={section.id} className={`settings-nav-link${active === section.id ? ' is-active' : ''}`} href={`/settings/${section.id}`} aria-current={active === section.id ? 'page' : undefined} onClick={() => setActive(section.id)}>{section.label}</a>
  }

  if (!token) return null
  return <main className="settings-page">
    <AppHeader />
    <section className="settings-shell" aria-label="Settings">
      <aside className="settings-sidebar">
        <h1>Settings</h1>
        <div className="settings-sidebar-content">
          <h2>Account</h2>
          <nav className="settings-nav-group" aria-label="Account settings">
            {accountSections.map(sectionLink)}
            <button className="settings-nav-link" type="button" onClick={logOut}>Log Out</button>
          </nav>
          <h2 className="settings-app-heading">App</h2>
          <nav className="settings-nav-group" aria-label="App information">
            {appSections.map(sectionLink)}
          </nav>
        </div>
      </aside>
      <section className="settings-main" aria-labelledby="settings-page-title">
        <header className="settings-main-heading"><h2 id="settings-page-title">{title}</h2></header>
        <div className={`settings-content settings-content-${active}`}>
          {active === 'account' && <AccountInformation token={token} />}
          {active === 'edit-profile' && <EditProfilePage embedded />}
          {active === 'change-password' && <ChangePassword token={token} />}
          {!['account', 'edit-profile', 'change-password'].includes(active) && <div className="settings-work-in-progress" role="status"><span aria-hidden="true">♪</span><p>Work in progress</p></div>}
        </div>
      </section>
    </section>
  </main>
}

export default SettingsPage
