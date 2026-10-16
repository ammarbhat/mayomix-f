import './AppHeader.css'

function AppHeader() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  const active = path === '/activity' ? 'activity' : path === '/search' ? 'search' : 'profile'
  return (
    <>
    <header className="app-header">
      <a className="app-brand" href="/profile" aria-label="Mayomix home">
        <img src="/images/mayomix-logo.png" alt="" />
        <span>mayomix</span>
      </a>
      <nav className="app-header-actions" aria-label="Main navigation">
        <a className="app-header-link activity-link" href="/activity" aria-label="Activity"><img src="/images/arrow.png" alt="" /></a>
        <a className="app-header-link search-link" href="/search" aria-label="Search"><img src="/images/search-interface-symbol.png" alt="" /></a>
        <a className="app-header-profile" href="/profile" aria-label="Your profile"><span /></a>
      </nav>
    </header>
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      <a className={active === 'activity' ? 'is-active' : ''} href="/activity" aria-label="Activity"><img src="/images/arrow.png" alt="" /></a>
      <a className={active === 'search' ? 'is-active' : ''} href="/search" aria-label="Search"><img src="/images/search-interface-symbol.png" alt="" /></a>
      <a className={active === 'profile' ? 'is-active' : ''} href="/profile" aria-label="Your profile"><span /></a>
    </nav>
    </>
  )
}

export default AppHeader
