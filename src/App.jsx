import LoginPage from './LoginPage.jsx'
import ProfilePage from './ProfilePage.jsx'
import SearchPage from './SearchPage.jsx'

function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  if (path === '/profile') return <ProfilePage />
  if (path === '/search') return <SearchPage />
  return <LoginPage />
}

export default App
