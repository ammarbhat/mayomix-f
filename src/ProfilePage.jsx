import { useEffect, useState } from 'react'
import { apiRequest, clearStoredToken, getStoredToken, getTasteList, itemDetails } from './api.js'
import './ProfilePage.css'

const emptyProfile = { user: null, topAlbums: [], songs: [], rotationAlbums: [], genres: [], artists: [] }

function textValue(item) {
  return itemDetails(item).title || ''
}

function AppHeader({ onSignOut }) {
  return (
    <header className="profile-header">
      <a className="profile-brand" href="/profile"><img src="/images/mayomix-logo.png" alt="" /><span>MayoMix</span></a>
      <nav className="profile-actions" aria-label="Profile actions">
        <button className="profile-action back-action" type="button" onClick={onSignOut} aria-label="Sign out"><span>↑</span></button>
        <a className="profile-action search-action" href="#top-albums" aria-label="Jump to top albums"><img src="/images/search-interface-symbol.png" alt="" /></a>
        <a className="profile-action current-action" href="#profile" aria-label="Current profile"><span /></a>
      </nav>
    </header>
  )
}

function ProfilePage() {
  const [profile, setProfile] = useState(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const token = getStoredToken()

  useEffect(() => {
    if (!token) {
      window.location.replace('/login')
      return
    }

    let cancelled = false
    async function loadProfile() {
      setLoading(true)
      setError('')
      try {
        const user = await apiRequest('/users/me', { token })
        const categories = ['top_albums', 'rotation_song', 'rotation_album', 'top_artists', 'top_genres']
        const results = await Promise.allSettled(categories.map((category) => getTasteList(user.username, category, token)))
        if (cancelled) return

        const taste = Object.fromEntries(categories.map((category, index) => [
          category,
          results[index].status === 'fulfilled' ? results[index].value : [],
        ]))
        const savedGenres = Array.isArray(user.fav_genres) ? user.fav_genres.map(textValue).filter(Boolean) : []
        setProfile({
          user,
          topAlbums: taste.top_albums,
          songs: taste.rotation_song,
          rotationAlbums: taste.rotation_album,
          artists: taste.top_artists,
          genres: savedGenres.length ? savedGenres : taste.top_genres,
        })
        const failedCategories = results.filter((result) => result.status === 'rejected').length
        if (failedCategories) setError('Some taste lists could not be loaded from the API.')
      } catch (requestError) {
        if (cancelled) return
        if (/401|unauthorized|unauthenticated|not authenticated|credentials/i.test(requestError.message)) {
          clearStoredToken()
          window.location.replace('/login')
          return
        }
        setError(requestError.message || 'Could not load profile data from the API.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProfile()
    return () => { cancelled = true }
  }, [token])

  function signOut() {
    clearStoredToken()
    window.location.assign('/login')
  }

  if (!token) return null

  return (
    <main className="profile-page" id="profile">
      <AppHeader onSignOut={signOut} />
      <div className="profile-wrap">
        <section className="profile-board" aria-label="Your music profile">
          <aside className="identity-panel">
            <img
              className="identity-art"
              src={profile.user?.pfp_link || '/images/profile-vinyl.png'}
              alt="Profile"
              onError={(event) => { event.currentTarget.src = '/images/profile-vinyl.png' }}
            />
            <h1>{profile.user?.name || (loading ? 'Loading…' : 'Your profile')}</h1>
            <div className="identity-rule" />
            <section className="identity-section">
              <h2>Genres</h2>
              <div className="identity-well genre-well">
                {profile.genres.map((genre, index) => <span key={`${textValue(genre)}-${index}`}>{textValue(genre)}</span>)}
                {!loading && profile.genres.length === 0 && <p className="empty-note">No genres yet</p>}
              </div>
            </section>
            <section className="identity-section artists-section">
              <h2>Artists</h2>
              <div className="identity-well artist-well">
                {profile.artists.map((artist, index) => <span key={`${textValue(artist)}-${index}`}><b>{String(index + 1).padStart(2, '0')}</b>{textValue(artist)}</span>)}
                {!loading && profile.artists.length === 0 && <p className="empty-note">No artists yet</p>}
              </div>
            </section>
          </aside>

          <div className="listening-panel">
            <section className="music-section" id="top-albums">
              <div className="music-heading"><h2>Top Albums</h2></div>
              <div className="albums-well">
                {profile.topAlbums.map((album, index) => {
                  const item = itemDetails(album)
                  return <article className="album-item" key={item.mbid || item.title || index}>
                    <div className={`album-cover album-cover-${index % 3 + 1}`}>
                      {item.image ? <img className="api-cover" src={item.image} alt="" /> : <img src="/images/two-concentric-disks.png" alt="" />}
                      <span>{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <h3>{item.title || 'Album'}</h3>
                  </article>
                })}
                {!loading && profile.topAlbums.length === 0 && <p className="empty-note">No top albums yet</p>}
              </div>
            </section>

            <section className="music-section rotation-section" id="rotation">
              <div className="music-heading"><h2>Rotation</h2></div>
              <div className="rotation-well">
                <div className="songs-column">
                  <h3>songs</h3>
                  <div className="song-grid">
                    {profile.songs.map((song, index) => {
                      const item = itemDetails(song)
                      return <article className="song-item" key={item.mbid || item.title || index}>
                        <div className={`song-cover song-cover-${index % 3}`}>
                          {item.image ? <img className="api-cover" src={item.image} alt="" /> : <img src="/images/two-concentric-disks.png" alt="" />}
                          <span>{String(index + 1).padStart(2, '0')}</span>
                        </div>
                        <p title={item.title}>{item.title || 'Song'}</p>
                      </article>
                    })}
                    {!loading && profile.songs.length === 0 && <p className="empty-note">No songs in rotation</p>}
                  </div>
                </div>
                <div className="rotation-divider" />
                <div className="rotation-albums">
                  <h3>albums</h3>
                  <div className="rotation-album-list">
                    {profile.rotationAlbums.map((album, index) => {
                      const item = itemDetails(album)
                      return <div className={`rotation-album-cover album-cover-${index % 3 + 1}`} key={item.mbid || item.title || index} title={item.title}>
                        {item.image ? <img className="api-cover" src={item.image} alt="" /> : <img src="/images/two-concentric-disks.png" alt="" />}
                        <span>{String(index + 1).padStart(2, '0')}</span>
                      </div>
                    })}
                    {!loading && profile.rotationAlbums.length === 0 && <p className="empty-note">No albums in rotation</p>}
                  </div>
                </div>
              </div>
            </section>
            {loading && <p className="profile-status" role="status">Loading profile data…</p>}
            {error && <p className="profile-status" role="status">{error}</p>}
          </div>
        </section>
      </div>
    </main>
  )
}

export default ProfilePage
