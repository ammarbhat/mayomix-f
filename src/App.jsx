import LoginPage from './LoginPage.jsx'
import ProfilePage from './ProfilePage.jsx'
import SearchPage from './SearchPage.jsx'
import UserReviewsPage from './UserReviewsPage.jsx'

function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  if (path === '/profile') return <ProfilePage />
  if (path === '/search') return <SearchPage />
  const segments = path.split('/').filter(Boolean)
  if (segments[0] === 'users' && segments.length === 2) {
    return <ProfilePage username={decodeURIComponent(segments[1])} />
  }
  if (segments[0] === 'users' && segments.length === 3 && segments[2] === 'reviews') {
    return <UserReviewsPage username={decodeURIComponent(segments[1])} />
  }
  return <LoginPage />
}

export default App
