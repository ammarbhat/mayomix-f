import { Link, useLocation } from 'react-router'
import './AppHeader.css'

function AppHeader({ mobileTitle, mobileBackTo = '/profile', hideMobileNavigation = false }) {
  const path = useLocation().pathname.replace(/\/$/, '') || '/'
  const active = path === '/activity' ? 'activity' : path === '/search' ? 'search' : 'profile'
  return (
    <>
    <header className="app-header">
      <Link className="app-brand" to="/profile" aria-label="Mayomix home">
        <img src="/images/mayomix-logo.png" alt="" />
        <span>mayomix</span>
      </Link>
      <nav className="app-header-actions" aria-label="Main navigation">
        <Link className={`app-header-link activity-link${active === 'activity' ? ' is-active' : ''}`} to="/activity" aria-label="Activity" aria-current={active === 'activity' ? 'page' : undefined}><img src="/images/arrow.png" alt="" /></Link>
        <Link className={`app-header-link search-link${active === 'search' ? ' is-active' : ''}`} to="/search" aria-label="Search" aria-current={active === 'search' ? 'page' : undefined}><img src="/images/search-interface-symbol.png" alt="" /></Link>
        <Link className={`app-header-profile${active === 'profile' ? ' is-active' : ''}`} to="/profile" aria-label="Your profile" aria-current={active === 'profile' ? 'page' : undefined}><span /></Link>
      </nav>
    </header>
    {mobileTitle && <header className="mobile-page-header">
      <Link className="mobile-page-header-back" to={mobileBackTo} aria-label="Back to profile">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6" /></svg>
      </Link>
      <span>{mobileTitle}</span>
    </header>}
    {!hideMobileNavigation && <nav className="mobile-bottom-nav" aria-label="Main navigation">
      <Link className={active === 'activity' ? 'is-active' : ''} to="/activity" aria-label="Activity" aria-current={active === 'activity' ? 'page' : undefined}><img src="/images/arrow.png" alt="" /></Link>
      <Link className={active === 'search' ? 'is-active' : ''} to="/search" aria-label="Search" aria-current={active === 'search' ? 'page' : undefined}><img src="/images/search-interface-symbol.png" alt="" /></Link>
      <Link className={active === 'profile' ? 'is-active' : ''} to="/profile" aria-label="Your profile" aria-current={active === 'profile' ? 'page' : undefined}><span /></Link>
    </nav>}
    </>
  )
}

export default AppHeader
