import { useEffect, useState } from 'react'
import { apiRequest, clearStoredToken, getStoredToken, getTasteList, itemDetails } from './api.js'
import './ProfilePage.css'

const emptyProfile = { user: null, topAlbums: [], songs: [], rotationAlbums: [], genres: [], artists: [] }

function AppHeader({ onSignOut }) {
  return (
    <header className="profile-header">
      <a className="profile-brand" href="/profile"><img src="/images/mayomix-logo.png" alt="" /><span>mayomix</span></a>
      <nav className="profile-actions" aria-label="Profile actions">
        <button className="profile-action back-action" type="button" onClick={onSignOut} aria-label="Sign out"><span>⌃</span></button>
        <a className="profile-action search-action" href="#top-albums" aria-label="Jump to top albums"><img src="/images/search-interface-symbol.png" alt="" /></a>
        <a className="profile-action current-action" href="#profile" aria-label="Current profile"><span /></a>
      </nav>
    </header>
  )
}

function PlaceholderCards({ count = 3, className = '' }) {
  return Array.from({ length: count }, (_, index) => (
    <div className={`placeholder-card ${className}`} key={`placeholder-${index}`} aria-hidden="true">
      <div className="placeholder-square" />
      {className === 'top-album-placeholder' && <div className="placeholder-rating" />}
    </div>
  ))
}

function Artwork({ item, className = '' }) {
  const details = itemDetails(item)
  return (
    <div className={`artwork ${className}`}>
      {details.image && <img className="image-fade" src={details.image} alt={`${details.title || 'Music'} artwork`} loading="lazy" onLoad={(event) => event.currentTarget.classList.add('is-loaded')} onError={(event) => { event.currentTarget.remove() }} />}
    </div>
  )
}

function RatingVinyls({ item }) {
  const details = itemDetails(item)
  const value = Number(details.rating ?? details.score ?? details.value ?? details.rating_value)
  if (!Number.isFinite(value)) return null
  const rating = Math.max(0, Math.min(10, value))
  return (
    <div className="rating-vinyls" role="img" aria-label={`Rated ${rating} out of 10`}>
      {Array.from({ length: 5 }, (_, index) => <span className="vinyl-rating" key={index}>
        <img src="/images/vinyl-half.png" alt="" style={{ opacity: rating > index * 2 ? 1 : 0.16 }} />
        <img className="vinyl-half-right" src="/images/vinyl-half.png" alt="" style={{ opacity: rating > index * 2 + 1 ? 1 : 0.16 }} />
      </span>)}
    </div>
  )
}

function MediaSection({ id, title, items, loading, type = 'artwork' }) {
  const className = `media-grid media-grid-${type}`
  return (
    <section className={`music-section music-section-${type}`} id={id} aria-busy={loading}>
      <h2>{title}</h2>
      <div className={className}>
        {items.slice(0, 3).map((entry, index) => {
          const item = itemDetails(entry)
          return (
            <article className="media-card" key={item.mbid || `${item.title}-${index}`}>
              <Artwork item={item} />
              {type === 'top-album' ? <RatingVinyls item={entry} /> : null}
              {type === 'song' && <div className="media-copy"><h3 title={item.title}>{item.title || 'Unknown song'}</h3><p title={item.artist}>{item.artist || item.album || ''}</p></div>}
            </article>
          )
        })}
        {!loading && items.length === 0 && <PlaceholderCards className={`${type}-placeholder`} />}
        {loading && items.length === 0 && <PlaceholderCards className={`${type}-placeholder`} />}
      </div>
    </section>
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
        const savedGenres = Array.isArray(user.fav_genres) ? user.fav_genres.map(itemDetails).map((item) => item.title).filter(Boolean) : []
        setProfile({
          user,
          topAlbums: taste.top_albums,
          songs: taste.rotation_song,
          rotationAlbums: taste.rotation_album,
          artists: taste.top_artists,
          genres: savedGenres.length ? savedGenres : taste.top_genres,
        })
        if (results.some((result) => result.status === 'rejected')) setError('Some taste lists could not be loaded.')
      } catch (requestError) {
        if (cancelled) return
        if (/401|unauthorized|unauthenticated|not authenticated|credentials/i.test(requestError.message)) {
          clearStoredToken()
          window.location.replace('/login')
          return
        }
        setError(requestError.message || 'Could not load profile data.')
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

  const user = profile.user || {}
  const handle = user.username || user.handle || user.name || 'listener'
  const bio = user.bio || user.biography || user.about || ''

  return (
    <main className="profile-page" id="profile">
      <AppHeader onSignOut={signOut} />
      <div className="profile-wrap">
        <section className="profile-board" aria-label="Your music profile">
          <aside className="profile-sidebar" aria-busy={loading}>
            <section className="identity-panel">
              <img className="identity-art image-fade" src={user.pfp_link || '/images/profile-vinyl.png'} alt={`${user.name || handle}'s profile picture`} onLoad={(event) => event.currentTarget.classList.add('is-loaded')} onError={(event) => { if (!event.currentTarget.src.endsWith('/images/profile-vinyl.png')) event.currentTarget.src = '/images/profile-vinyl.png' }} />
              <h1>{loading && !user.name ? <span className="text-skeleton name-skeleton" aria-label="Loading profile" /> : user.name || 'Your profile'}</h1>
              <p className="identity-handle">{loading && !user.username ? <span className="text-skeleton handle-skeleton" aria-label="Loading username" /> : `@${handle}`}</p>
              <p className="identity-bio">{loading && !bio ? <span className="text-skeleton bio-skeleton" aria-label="Loading bio" /> : bio}</p>
            </section>
            <section className="details-panel" aria-label="Your favorites">
              <div className="identity-section">
                <h2>Top genres</h2>
                <div className="identity-list genre-list">
                  {loading && profile.genres.length === 0 && <span className="list-skeleton" aria-label="Loading genres" />}
                  {profile.genres.slice(0, 5).map((genre, index) => <span key={`${itemDetails(genre).title}-${index}`}>{itemDetails(genre).title}</span>)}
                  {!loading && profile.genres.length === 0 && <span className="muted-placeholder">No genres yet</span>}
                </div>
              </div>
              <div className="identity-section artist-section">
                <h2>Top artists</h2>
                <div className="identity-list artist-list">
                  {loading && profile.artists.length === 0 && <span className="list-skeleton" aria-label="Loading artists" />}
                  {profile.artists.slice(0, 4).map((artist, index) => <span key={`${itemDetails(artist).mbid || itemDetails(artist).title}-${index}`}>{itemDetails(artist).title}</span>)}
                  {!loading && profile.artists.length === 0 && <span className="muted-placeholder">No artists yet</span>}
                </div>
              </div>
            </section>
          </aside>

          <div className="listening-panel">
            <MediaSection id="top-albums" title="Top Albums" items={profile.topAlbums} loading={loading} type="top-album" />
            <MediaSection id="rotation" title="Rotation" items={profile.rotationAlbums} loading={loading} type="rotation" />
            <MediaSection id="songs" title="Songs" items={profile.songs} loading={loading} type="song" />
            {error && <p className="profile-status" role="status">{error}</p>}
          </div>
        </section>
      </div>
    </main>
  )
}

export default ProfilePage
