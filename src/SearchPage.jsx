import { useCallback, useEffect, useRef, useState } from 'react'
import {
  apiRequest,
  clearStoredToken,
  getConnectionStatus,
  getAlbumDetails,
  getLikedSongs,
  getStoredToken,
  getUserReviews,
  itemDetails,
  searchAlbums,
  searchUsers,
} from './api.js'
import './SearchPage.css'

const emptyLibrary = { likedSongs: [], reviews: [] }

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.2" /><path d="m16.2 16.2 5 5" /></svg>
}

function HeartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5-8.8 11-8.8 11s-8.8-6-8.8-11A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z" /></svg>
}

function AppHeader() {
  return (
    <header className="search-header">
      <a className="search-brand" href="/profile" aria-label="Mayo-Mix home">
        <img src="/images/mayomix-logo.png" alt="" />
        <span>mayomix</span>
      </a>
      <nav className="search-header-actions" aria-label="Main navigation">
        <a className="search-header-button header-activity" href="/profile" aria-label="Your profile"><span>⌃</span></a>
        <a className="search-header-button header-search-active" href="/search" aria-label="Search"><SearchIcon /></a>
        <a className="header-avatar" href="/profile" aria-label="Your profile"><span /></a>
      </nav>
    </header>
  )
}

function displayArtist(item) {
  const details = itemDetails(item)
  if (details.artist) return details.artist
  const credits = item?.['artist-credit'] || item?.artist_credit
  if (Array.isArray(credits)) return credits.map((credit) => `${credit.name || credit.artist?.name || ''}${credit.joinphrase || ''}`).join('').trim()
  return item?.artist_name || item?.artist?.name || item?.album_artist || ''
}

function imageFor(item) {
  const details = itemDetails(item)
  return details.image || item?.cover_art || item?.cover || ''
}

function Artwork({ item, alt }) {
  const image = imageFor(item)
  const images = [...new Set([image, ...(item?.coverCandidates || item?.cover_candidates || [])].filter(Boolean))]
  return (
    <div className="search-artwork">
      <span aria-hidden="true">♪</span>
      {images.length > 0 && <img
        src={images[0]}
        alt={alt}
        loading="lazy"
        onError={(event) => {
          const imageElement = event.currentTarget
          const nextIndex = Number(imageElement.dataset.fallbackIndex || 0) + 1
          if (images[nextIndex]) {
            imageElement.dataset.fallbackIndex = String(nextIndex)
            imageElement.src = images[nextIndex]
          } else imageElement.remove()
        }}
      />}
    </div>
  )
}

function Rating({ review }) {
  const rating = Number(review.rating ?? review.score ?? review.value)
  if (!Number.isFinite(rating)) return null
  const amount = Math.max(0, Math.min(5, Math.round(rating / 2)))
  return <span className="review-rating" aria-label={`Rated ${rating} out of 10`}>{Array.from({ length: 5 }, (_, index) => <i className={index < amount ? 'is-filled' : ''} key={index} />)}</span>
}

function LikedSongCard({ item }) {
  const details = itemDetails(item)
  const title = details.title || item?.song_title || item?.recording?.title || 'Unknown song'
  const artist = displayArtist(item) || 'Unknown artist'
  return (
    <article className="liked-song-card">
      <Artwork item={item} alt={`${title} artwork`} />
      <div className="liked-song-copy">
        <h3 title={title}>{title}</h3>
        <p title={artist}>{artist}</p>
      </div>
      <span className="liked-heart" aria-label="Liked song"><HeartIcon /></span>
    </article>
  )
}

function ReviewCard({ review }) {
  const album = review.album || review.album_info || review.metadata || {}
  const title = album.title || review.album_title || review.title || 'Album review'
  const artist = album.artist || review.artist || review.artist_name || ''
  const text = review.review_text || review.text || review.review || review.body || ''
  return (
    <article className="album-review-card">
      <Artwork item={{ ...album, image: album.image || review.cover_url || review.image }} alt={`${title} cover`} />
      <div className="review-copy">
        <h3 title={title}>{title}</h3>
        {artist && <p className="review-artist" title={artist}>{artist}</p>}
        <Rating review={review} />
        {text && <p className="review-text">{text}</p>}
      </div>
    </article>
  )
}

function AlbumResult({ album }) {
  const title = album.title || album.name || 'Unknown album'
  const artist = displayArtist(album) || 'Unknown artist'
  return (
    <article className="search-result-card album-result-card">
      <Artwork item={album} alt={`${title} cover`} />
      <div className="search-result-copy">
        <h3 title={title}>{title}</h3>
        <p title={artist}>{artist}</p>
        {album.year && <span className="album-year">{album.year}</span>}
      </div>
    </article>
  )
}

function UserResult({ user, token }) {
  const name = user.name || user.display_name || user.full_name || user.username || 'Mayo-Mix listener'
  const username = user.username || user.handle || ''
  const image = user.pfp_link || user.profile_image || user.avatar_url || user.avatar || ''
  const [connectionStatus, setConnectionStatus] = useState(user.is_connected || user.connected ? 'connected' : 'not_found')

  useEffect(() => {
    if (!token || !username) return undefined
    let cancelled = false
    getConnectionStatus(username, token).then((status) => {
      if (!cancelled) setConnectionStatus(status)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [token, username])

  const stateImage = connectionStatus === 'connected'
    ? '/images/connection-check.png'
    : ['pending_sent', 'pending_received', 'pending_recieved'].includes(connectionStatus)
      ? '/images/connection-pending.png'
      : '/images/connection-plus.png'
  return (
    <a className="search-result-card user-result-card" href={username ? `/users/${encodeURIComponent(username)}` : undefined}>
      <div className="user-artwork">
        <img src={image || '/images/profile-vinyl.png'} alt={`${name}'s profile`} onError={(event) => { event.currentTarget.src = '/images/profile-vinyl.png' }} />
      </div>
      <div className="search-result-copy">
        <h3 title={name}>{name}</h3>
        {username && <p title={`@${username}`}>@{username}</p>}
      </div>
      <span className="user-state-icon" aria-hidden="true"><img src={stateImage} alt="" /></span>
    </a>
  )
}

function SearchPage() {
  const token = getStoredToken()
  const inputRef = useRef(null)
  const [library, setLibrary] = useState(emptyLibrary)
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [libraryError, setLibraryError] = useState('')
  const [activeLibraryTab, setActiveLibraryTab] = useState('liked')
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [activeSearchTab, setActiveSearchTab] = useState('albums')
  const [results, setResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    if (!token) {
      window.location.replace('/login')
      return undefined
    }

    let cancelled = false
    async function loadLibrary() {
      try {
        const me = await apiRequest('/users/me', { token })
        const [likedSongs, reviews] = await Promise.all([
          getLikedSongs(token),
          getUserReviews(me.username, token),
        ])
        if (cancelled) return
        const reviewItems = reviews.slice(0, 12)
        const enrichedReviews = await Promise.all(reviewItems.map(async (review) => {
          const album = review.album || review.album_info || review.metadata || {}
          const mbid = review.album_mbid || review.mbid || album.mbid || album.id
          const hasTitle = album.title || review.album_title || review.title
          if (!mbid || hasTitle) return review
          try {
            const metadata = await getAlbumDetails(mbid, token)
            return { ...review, album: { ...album, ...metadata } }
          } catch {
            return review
          }
        }))
        if (!cancelled) setLibrary({ likedSongs, reviews: enrichedReviews })
      } catch (error) {
        if (!cancelled) {
          if (/401|unauthorized|unauthenticated|not authenticated|credentials/i.test(error.message)) {
            clearStoredToken()
            window.location.replace('/login')
          } else setLibraryError(error.message || 'Could not load your music.')
        }
      } finally {
        if (!cancelled) setLibraryLoading(false)
      }
    }
    loadLibrary()
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (!expanded) return undefined
    function handleEscape(event) {
      if (event.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [expanded])

  const runSearch = useCallback(async (value = query, tab = activeSearchTab) => {
    const term = value.trim()
    if (!term) {
      setSubmittedQuery('')
      setResults([])
      setSearchError('')
      return
    }
    setSubmittedQuery(term)
    setSearchLoading(true)
    setSearchError('')
    setResults([])
    try {
      const found = tab === 'users' ? await searchUsers(term) : await searchAlbums(term, token)
      setResults(found)
    } catch (error) {
      if (/401|unauthorized|unauthenticated|not authenticated|credentials/i.test(error.message)) {
        clearStoredToken()
        window.location.replace('/login')
        return
      }
      setSearchError(error.message || 'Search could not be completed.')
    } finally {
      setSearchLoading(false)
    }
  }, [activeSearchTab, query, token])

  function selectSearchTab(tab) {
    setActiveSearchTab(tab)
    if (submittedQuery) runSearch(submittedQuery, tab)
  }

  function handleSubmit(event) {
    event.preventDefault()
    runSearch(query)
  }

  function expandSearch() {
    setExpanded(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const visibleLibraryItems = activeLibraryTab === 'liked' ? library.likedSongs : library.reviews

  return (
    <main className="search-page">
      <AppHeader />
      <section className={`search-workspace${expanded ? ' is-expanded' : ''}`}>
        <form className="main-search-form" onClick={() => { if (!expanded) expandSearch() }} onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            aria-label="Search albums and users"
            placeholder="Search."
            value={query}
            onFocus={() => setExpanded(true)}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="submit-search" type="submit" aria-label="Search"><SearchIcon /></button>
        </form>

        {expanded ? (
          <section className="expanded-search-panel" aria-label="Search results" aria-busy={searchLoading}>
            <div className="search-tabs" role="tablist" aria-label="Search category">
              <button type="button" role="tab" aria-selected={activeSearchTab === 'albums'} className={activeSearchTab === 'albums' ? 'is-active' : ''} onClick={() => selectSearchTab('albums')}>Albums</button>
              <button type="button" role="tab" aria-selected={activeSearchTab === 'users'} className={activeSearchTab === 'users' ? 'is-active' : ''} onClick={() => selectSearchTab('users')}>Users</button>
            </div>
            <div className="search-results" role="tabpanel">
              {!submittedQuery && <p className="search-hint">Search for albums or people</p>}
              {searchLoading && <p className="search-message" role="status">Searching…</p>}
              {searchError && !searchLoading && <p className="search-message is-error" role="alert">{searchError}</p>}
              {!searchLoading && !searchError && submittedQuery && results.length === 0 && <p className="search-message" role="status">No {activeSearchTab} found for “{submittedQuery}”.</p>}
              {!searchLoading && results.map((result, index) => activeSearchTab === 'users'
                ? <UserResult key={result.id || result.user_id || result.username || index} user={result} token={token} />
                : <AlbumResult key={result.mbid || result.id || index} album={result} />)}
            </div>
          </section>
        ) : (
          <section className="library-board" aria-label="Your music" aria-busy={libraryLoading}>
            <div className="library-tabs" role="tablist" aria-label="Your music collections">
              <button type="button" role="tab" aria-selected={activeLibraryTab === 'liked'} className={activeLibraryTab === 'liked' ? 'is-active' : ''} onClick={() => setActiveLibraryTab('liked')}>Liked songs</button>
              <button type="button" role="tab" aria-selected={activeLibraryTab === 'reviews'} className={activeLibraryTab === 'reviews' ? 'is-active' : ''} onClick={() => setActiveLibraryTab('reviews')}>Album reviews</button>
            </div>
            <div className="library-grid" role="tabpanel">
              {libraryLoading && <p className="search-message" role="status">Loading your music…</p>}
              {libraryError && !libraryLoading && <p className="search-message is-error" role="alert">{libraryError}</p>}
              {!libraryLoading && !libraryError && visibleLibraryItems.length === 0 && <p className="search-message empty-library">{activeLibraryTab === 'liked' ? 'Your liked songs will appear here.' : 'Your album reviews will appear here.'}</p>}
              {!libraryLoading && visibleLibraryItems.map((item, index) => activeLibraryTab === 'liked'
                ? <LikedSongCard item={item} key={item.mbid || item.id || index} />
                : <ReviewCard review={item} key={item.id || item.review_id || item.album_mbid || index} />)}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

export default SearchPage
