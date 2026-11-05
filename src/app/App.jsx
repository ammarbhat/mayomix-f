import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import LoginPage from '../pages/auth/LoginPage.jsx'
import ProfilePage from '../pages/profile/ProfilePage.jsx'
import SearchPage from '../pages/search/SearchPage.jsx'
import UserReviewsPage from '../pages/reviews/UserReviewsPage.jsx'
import AlbumPage from '../pages/albums/AlbumPage.jsx'
import ActivityPage from '../pages/activity/ActivityPage.jsx'
import TastePage from '../pages/taste/TastePage.jsx'
import EditProfilePage from '../pages/profile/EditProfilePage.jsx'
import SettingsPage from '../pages/settings/SettingsPage.jsx'

function App() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/profile" element={<ProfilePage key="self-profile" />} />
      <Route path="/users/:username" element={<ProfilePage key={`public-profile:${pathname}`} />} />
      <Route path="/users/:username/reviews" element={<UserReviewsPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/albums/:mbid" element={<AlbumPage />} />
      <Route path="/activity" element={<ActivityPage />} />
      <Route path="/taste" element={<TastePage />} />
      <Route path="/edit-profile" element={<EditProfilePage />} />
      <Route path="/settings/*" element={<SettingsPage />} />
      <Route path="*" element={<LoginPage />} />
    </Routes>
  )
}

export default App
