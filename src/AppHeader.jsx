import './AppHeader.css'

function AppHeader() {
  return (
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
  )
}

export default AppHeader
