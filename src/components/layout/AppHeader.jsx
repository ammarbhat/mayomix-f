import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import './AppHeader.css'

function AppHeader({ mobileTitle, mobileBackTo = '/profile', hideMobileNavigation = false, alwaysShowMobileNavigation = false }) {
  const [isMobileNavHidden, setIsMobileNavHidden] = useState(false)
  const mobileNavRef = useRef(null)
  const path = useLocation().pathname.replace(/\/$/, '') || '/'
  const active = path === '/activity' ? 'activity' : path === '/search' ? 'search' : 'profile'
  const shouldHideMobileNavigation = isMobileNavHidden && !alwaysShowMobileNavigation

  useEffect(() => {
    if (alwaysShowMobileNavigation) return undefined

    const mobileViewport = window.matchMedia('(max-width: 760px)')
    let previousScroller = null
    let previousPosition = 0
    let previousTime = 0
    let scrollDirection = null
    let upwardDistance = 0
    let lastVisibilityChange = 0
    let navHidden = false

    const reset = () => {
      previousScroller = null
      previousTime = 0
      scrollDirection = null
      upwardDistance = 0
      navHidden = false
      setIsMobileNavHidden(false)
    }

    const handleScroll = (event) => {
      if (!mobileViewport.matches) return

      const scroller = event.target
      const position = scroller === document || scroller === document.documentElement || scroller === document.body
        ? window.scrollY
        : scroller?.scrollTop

      if (typeof position !== 'number') return

      const now = performance.now()
      if (scroller !== previousScroller) {
        previousScroller = scroller
        previousPosition = position
        previousTime = now
        return
      }

      const distance = position - previousPosition
      const elapsed = now - previousTime
      previousPosition = position
      previousTime = now

      if (mobileNavRef.current?.contains(document.activeElement)) {
        navHidden = false
        upwardDistance = 0
        setIsMobileNavHidden(false)
        return
      }

      if (position <= 2) {
        navHidden = false
        upwardDistance = 0
        setIsMobileNavHidden(false)
      } else if (distance < 0) {
        if (scrollDirection !== 'up') upwardDistance = 0
        scrollDirection = 'up'
        upwardDistance += Math.abs(distance)
        if (navHidden && upwardDistance >= 10 && now - lastVisibilityChange >= 420) {
          navHidden = false
          upwardDistance = 0
          lastVisibilityChange = now
          setIsMobileNavHidden(false)
        }
      } else if (distance > 0) {
        scrollDirection = 'down'
        upwardDistance = 0
        if (!navHidden && distance >= 5 && elapsed > 0 && distance / elapsed >= 0.3 && now - lastVisibilityChange >= 420) {
          navHidden = true
          lastVisibilityChange = now
          setIsMobileNavHidden(true)
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    mobileViewport.addEventListener('change', reset)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      mobileViewport.removeEventListener('change', reset)
    }
  }, [alwaysShowMobileNavigation])

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
    {!hideMobileNavigation && <nav ref={mobileNavRef} className={`mobile-bottom-nav${shouldHideMobileNavigation ? ' is-hidden' : ''}`} aria-label="Main navigation" aria-hidden={shouldHideMobileNavigation} inert={shouldHideMobileNavigation}>
      <Link className={active === 'activity' ? 'is-active' : ''} to="/activity" aria-label="Activity" aria-current={active === 'activity' ? 'page' : undefined}><img src="/images/arrow.png" alt="" /></Link>
      <Link className={active === 'search' ? 'is-active' : ''} to="/search" aria-label="Search" aria-current={active === 'search' ? 'page' : undefined}><img src="/images/search-interface-symbol.png" alt="" /></Link>
      <Link className={active === 'profile' ? 'is-active' : ''} to="/profile" aria-label="Your profile" aria-current={active === 'profile' ? 'page' : undefined}><span /></Link>
    </nav>}
    </>
  )
}

export default AppHeader
