import { useEffect, useState } from 'react'
import LoginPage from './LoginPage.jsx'
import ProfilePage from './ProfilePage.jsx'
import SearchPage from './SearchPage.jsx'
import UserReviewsPage from './UserReviewsPage.jsx'
import AlbumPage from './AlbumPage.jsx'
import ActivityPage from './ActivityPage.jsx'
import TastePage from './TastePage.jsx'
import EditProfilePage from './EditProfilePage.jsx'

function App() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    function handleClick(event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target.closest('a[href]')
      if (!link || link.target || link.hasAttribute('download')) return
      const destination = new URL(link.href, window.location.href)
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return
      event.preventDefault()
      window.history.pushState({}, '', `${destination.pathname}${destination.search}${destination.hash}`)
      setPath(destination.pathname)
      window.scrollTo(0, 0)
    }
    function handlePopState() {
      setPath(window.location.pathname)
      window.scrollTo(0, 0)
    }
    document.addEventListener('click', handleClick)
    window.addEventListener('popstate', handlePopState)
    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const normalizedPath = path.replace(/\/$/, '') || '/'
  if (normalizedPath === '/profile') return <ProfilePage />
  if (normalizedPath === '/search') return <SearchPage />
  if (normalizedPath === '/activity') return <ActivityPage />
  if (normalizedPath === '/taste') return <TastePage />
  if (normalizedPath === '/edit-profile') return <EditProfilePage />
  const segments = normalizedPath.split('/').filter(Boolean)
  if (segments[0] === 'albums' && segments.length === 2) return <AlbumPage mbid={decodeURIComponent(segments[1])} />
  if (segments[0] === 'users' && segments.length === 2) {
    return <ProfilePage username={decodeURIComponent(segments[1])} />
  }
  if (segments[0] === 'users' && segments.length === 3 && segments[2] === 'reviews') {
    return <UserReviewsPage username={decodeURIComponent(segments[1])} />
  }
  return <LoginPage />
}

export default App
