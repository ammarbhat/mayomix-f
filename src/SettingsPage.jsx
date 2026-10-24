import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AppHeader from './AppHeader.jsx'
import EditProfilePage from './EditProfilePage.jsx'
import { apiRequest, changePassword, changeUsername, clearStoredToken, getAppDocument, getStoredToken } from './api.js'
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

function ChangeUsername({ token }) {
  const [currentUsername, setCurrentUsername] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiRequest('/users/me', { token, cache: false }).then((user) => {
      if (!cancelled) setCurrentUsername(user.username || '')
    }).catch((error) => {
      if (cancelled) return
      if (error.status === 401) {
        clearStoredToken()
        window.location.replace('/login')
      } else setFeedback({ type: 'error', text: error.message || 'Username could not be loaded.' })
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [token])

  async function submit(event) {
    event.preventDefault()
    if (saving || loading) return
    const username = newUsername.trim().replace(/^@/, '')
    setFeedback(null)
    if (!username) return
    if (username === currentUsername) {
      setFeedback({ type: 'error', text: 'Cannot use same username.' })
      return
    }

    setSaving(true)
    try {
      await changeUsername(username, token)
      setCurrentUsername(username)
      setNewUsername(`@${username}`)
      setFeedback({ type: 'success', text: 'Username changed successfully!', detail: 'Sign in again with your new username to continue.' })
      clearStoredToken()
      window.setTimeout(() => window.location.replace('/login'), 3000)
    } catch (error) {
      if (error.status === 409) setFeedback({ type: 'error', text: 'Username taken.' })
      else if (error.status === 401) {
        clearStoredToken()
        window.location.replace('/login')
      } else setFeedback({ type: 'error', text: error.message || 'Username could not be changed. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  return <form className="settings-username-form" onSubmit={submit} noValidate aria-busy={loading || saving}>
    <div className="settings-username-fields">
      <span className="settings-username-label">Old Username</span>
      <span className="settings-username-current">{loading ? 'Loading…' : currentUsername ? `@${currentUsername}` : '—'}</span>
      <label htmlFor="settings-new-username">New Username</label>
      <input id="settings-new-username" type="text" autoComplete="username" value={newUsername} onChange={(event) => { setNewUsername(event.target.value); setFeedback(null) }} placeholder="@username" required />
    </div>
    <button className="settings-password-submit" type="submit" disabled={loading || saving || !newUsername.trim()}>
      {saving ? 'Saving…' : 'Confirm Change'}
    </button>
    {feedback && <p className={`settings-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
      <img src={feedback.type === 'success' ? '/images/connection-check.png' : '/images/connection-decline.png'} alt="" />
      <span>{feedback.text}{feedback.detail && <small className="settings-feedback-detail">{feedback.detail}</small>}</span>
    </p>}
  </form>
}

function renderDocumentInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g)
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
    if (link) return <a key={key} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>
    return part
  })
}

function DocumentContent({ section }) {
  const [document, setDocument] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getAppDocument(section).then((content) => {
      if (!cancelled) setDocument(typeof content === 'string' ? content : '')
    }).catch((requestError) => {
      if (!cancelled) setError(requestError.message || 'This information could not be loaded.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [section])

  if (loading) return <p className="settings-loading" role="status">Loading…</p>
  if (error) return <p className="settings-load-error" role="alert">{error}</p>

  const blocks = document.trim().split(/\r?\n\s*\r?\n/)
  return <article className={`settings-document settings-document-${section}`}>
    {blocks.map((block, index) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      if (!lines.length) return null
      const heading = lines.length === 1 && lines[0].match(/^(#{1,3})\s+(.+)$/)
      if (heading) {
        const Tag = `h${Math.min(heading[1].length + 1, 4)}`
        return <Tag key={index}>{renderDocumentInline(heading[2], `heading-${index}`)}</Tag>
      }
      if (lines.every((line) => /^[-*]\s+/.test(line))) {
        return <ul key={index}>{lines.map((line, lineIndex) => <li key={lineIndex}>{renderDocumentInline(line.replace(/^[-*]\s+/, ''), `list-${index}-${lineIndex}`)}</li>)}</ul>
      }
      return <p key={index}>{lines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && ' '}{renderDocumentInline(line, `paragraph-${index}-${lineIndex}`)}</span>)}</p>
    })}
  </article>
}

function LogoutDialog({ onCancel, onConfirm, title = 'Are you sure you want to log out of mayomix?', cancelLabel = 'No', confirmLabel = 'Yes', confirmBusy = false }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const actions = dialogRef.current?.querySelectorAll('button:not(:disabled)')
    if (!actions?.length) return
    const first = actions[0]
    const last = actions[actions.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="settings-logout-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <section ref={dialogRef} className="settings-logout-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-logout-title" onKeyDown={handleKeyDown}>
        <h2 id="settings-logout-title">{title}</h2>
        <div className="settings-logout-actions">
          <button ref={cancelRef} className="settings-logout-choice" type="button" onClick={onCancel}>{cancelLabel}</button>
          <button className="settings-logout-choice is-confirm" type="button" onClick={onConfirm} disabled={confirmBusy}>{confirmLabel}</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}

function DeleteAccount({ token, onConfirmOpenChange }) {
  const [username, setUsername] = useState('')
  const [confirmedUsername, setConfirmedUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    let cancelled = false
    apiRequest('/users/me', { token, cache: false }).then((user) => {
      if (!cancelled) setUsername(user.username || '')
    }).catch((error) => {
      if (cancelled) return
      if (error.status === 401) {
        clearStoredToken()
        window.location.replace('/login')
      } else setFeedback({ text: error.message || 'Username could not be loaded.' })
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  function setConfirmation(open) {
    setConfirmOpen(open)
    onConfirmOpenChange(open)
  }

  function submit(event) {
    event.preventDefault()
    if (loading || deleting) return
    setFeedback(null)
    if (confirmedUsername.trim().replace(/^@/, '') !== username) {
      setFeedback({ text: 'Incorrect Username!' })
      return
    }
    if (!password) {
      setFeedback({ text: 'Enter your password to continue.' })
      return
    }
    setConfirmation(true)
  }

  async function deleteAccount() {
    if (deleting) return
    setDeleting(true)
    try {
      await apiRequest(`/users/${encodeURIComponent(username)}`, {
        method: 'DELETE', token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      sessionStorage.setItem('mayomix.account_deleted_notice', '1')
      clearStoredToken()
      window.location.replace('/login')
    } catch (error) {
      setConfirmation(false)
      if (error.status === 401 && /incorrect password/i.test(error.message || '')) setFeedback({ text: 'Incorrect Password!' })
      else if (error.status === 404) setFeedback({ text: 'Incorrect Username!' })
      else if (error.status === 401) {
        clearStoredToken()
        window.location.replace('/login')
      } else setFeedback({ text: error.message || 'Account could not be deleted. Try again.' })
    } finally { setDeleting(false) }
  }

  return <>
    <p className="settings-delete-warning">Deleting your account means all your data will be permanently deleted and cannot be recovered.</p>
    <form className="settings-delete-form" onSubmit={submit} noValidate aria-busy={loading || deleting}>
      <div className="settings-delete-fields">
        <label htmlFor="settings-confirm-username">Confirm Username</label>
        <input id="settings-confirm-username" type="text" autoComplete="username" placeholder="@username" value={confirmedUsername} onChange={(event) => { setConfirmedUsername(event.target.value); setFeedback(null) }} disabled={loading || deleting} required />
        <label htmlFor="settings-delete-password">Password</label>
        <input id="settings-delete-password" type="password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setFeedback(null) }} disabled={loading || deleting} required />
      </div>
      <button className="settings-delete-submit" type="submit" disabled={loading || deleting || !confirmedUsername || !password}>{deleting ? 'Deleting…' : 'Delete my account'}</button>
      {feedback && <p className="settings-feedback is-error" role="alert"><img src="/images/connection-decline.png" alt="" /><span>{feedback.text}</span></p>}
      {loading && <p className="settings-loading" role="status">Loading username…</p>}
    </form>
    {confirmOpen && <LogoutDialog
      title="Are you sure you want to delete your account?"
      onCancel={() => setConfirmation(false)}
      onConfirm={deleteAccount}
      confirmLabel={deleting ? 'Deleting…' : 'Yes'}
      confirmBusy={deleting}
    />}
  </>
}

function SettingsPage() {
  const token = getStoredToken()
  const [active, setActive] = useState(selectedSection)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const title = useMemo(() => [...accountSections, ...appSections].find((section) => section.id === active)?.label || 'Account Information', [active])

  useEffect(() => {
    if (!token) window.location.replace('/login')
  }, [token])

  useEffect(() => {
    function syncSection() { setActive(selectedSection()) }
    window.addEventListener('popstate', syncSection)
    return () => window.removeEventListener('popstate', syncSection)
  }, [])

  function confirmLogOut() {
    clearStoredToken()
    window.location.replace('/login')
  }

  function sectionLink(section) {
    if (section.id === 'github') return <a key={section.id} className="settings-nav-link" href="https://github.com/ammarbhat/mayomix" target="_blank" rel="noreferrer">{section.label}</a>
    return <a key={section.id} className={`settings-nav-link${active === section.id ? ' is-active' : ''}`} href={`/settings/${section.id}`} aria-current={active === section.id ? 'page' : undefined} onClick={() => setActive(section.id)}>{section.label}</a>
  }

  if (!token) return null
  return <main className="settings-page" inert={logoutOpen || deleteConfirmOpen}>
    <AppHeader />
    <section className="settings-shell" aria-label="Settings">
      <aside className="settings-sidebar">
        <h1>Settings</h1>
        <div className="settings-sidebar-content">
          <h2>Account</h2>
          <nav className="settings-nav-group" aria-label="Account settings">
            {accountSections.map(sectionLink)}
            <button className="settings-nav-link" type="button" onClick={() => setLogoutOpen(true)}>Log Out</button>
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
          {active === 'change-username' && <ChangeUsername token={token} />}
          {active === 'delete-account' && <DeleteAccount token={token} onConfirmOpenChange={setDeleteConfirmOpen} />}
          {['developer', 'privacy', 'terms'].includes(active) && <DocumentContent section={active} />}
          {!['account', 'edit-profile', 'change-password', 'change-username', 'delete-account', 'developer', 'privacy', 'terms'].includes(active) && <div className="settings-work-in-progress" role="status"><span aria-hidden="true">♪</span><p>Work in progress</p></div>}
        </div>
      </section>
    </section>
    {logoutOpen && <LogoutDialog onCancel={() => setLogoutOpen(false)} onConfirm={confirmLogOut} />}
  </main>
}

export default SettingsPage
