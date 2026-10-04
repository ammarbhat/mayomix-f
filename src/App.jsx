import LoginPage from './LoginPage.jsx'
import ProfilePage from './ProfilePage.jsx'

function App() {
  const isProfilePage = window.location.pathname.replace(/\/$/, '') === '/profile'
  return isProfilePage ? <ProfilePage /> : <LoginPage />
}

export default App
