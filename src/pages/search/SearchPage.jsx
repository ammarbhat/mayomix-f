import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  clearStoredToken,
  getConnectionStatus,
  getAlbumDetails,
  getTopRatedAlbums,
  getStoredToken,
  itemDetails,
  searchAlbums,
  searchUsers,
} from '../../api/api.js'
import AppHeader from '../../components/layout/AppHeader.jsx'
import usePagedMusicSearch from '../../hooks/usePagedMusicSearch.js'
import './SearchPage.css'

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.2" /><path d="m16.2 16.2 5 5" /></svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 16M20 4 4 20" /></svg>
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

function TopRatedAlbumCard({ entry, rank, token }) {
  const cardRef = useRef(null)
  const [album, setAlbum] = useState(null)
  const [metadataLoading, setMetadataLoading] = useState(Boolean(entry.mbid))
  const mbid = entry.mbid

  useEffect(() => {
    if (!mbid) return undefined
    let cancelled = false
    const load = () => getAlbumDetails(mbid, token).then((details) => {
      if (!cancelled) setAlbum(details)
    }).catch(() => {}).finally(() => { if (!cancelled) setMetadataLoading(false) })
    const node = cardRef.current
    if (!node || !('IntersectionObserver' in window)) {
      load()
      return () => { cancelled = true }
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect()
        load()
      }
    }, { rootMargin: '180px' })
    observer.observe(node)
    return () => { cancelled = true; observer.disconnect() }
  }, [mbid, token])

  const details = itemDetails(album || {})
  const title = details.title || (mbid && metadataLoading ? 'Loading album…' : 'Album details unavailable')
  const artist = displayArtist(details)
  const rating = Number(entry.avg_rating) / 2
  const reviewCount = Number(entry.count)
  const formattedRating = Number.isFinite(rating)
    ? Number.isInteger(rating) ? String(rating) : rating.toFixed(1)
    : '—'
  const formattedCount = Number.isFinite(reviewCount)
    ? new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(reviewCount)
    : '—'

  return (
    <div className="top-rated-row" ref={cardRef}>
      <span className="top-rated-rank" aria-label={`Rank ${rank}`}>{rank}</span>
      {metadataLoading && mbid
        ? <div className="top-rated-card top-rated-card-loading" role="status" aria-label={`Loading details for top rated album ${rank}`} aria-busy="true">
            <div className="top-rated-skeleton-main" aria-hidden="true">
              <span className="top-rated-skeleton top-rated-skeleton-cover" />
              <span className="top-rated-skeleton-copy">
                <span className="top-rated-skeleton top-rated-skeleton-title" />
                <span className="top-rated-skeleton top-rated-skeleton-subtitle" />
              </span>
            </div>
            <span className="top-rated-skeleton top-rated-skeleton-stat top-rated-skeleton-stat-rating" aria-hidden="true" />
            <span className="top-rated-skeleton top-rated-skeleton-stat top-rated-skeleton-stat-count" aria-hidden="true" />
          </div>
        : (
          <Link className="top-rated-card top-rated-card-ready" to={mbid ? `/albums/${encodeURIComponent(mbid)}` : '/'} onClick={(event) => { if (!mbid) event.preventDefault() }}>
            <div className="top-rated-main">
              <Artwork item={details} alt={`${title} cover`} />
              <div className="top-rated-copy">
                <h3 title={title}>{title}</h3>
                {artist && <p title={artist}>{artist}</p>}
              </div>
            </div>
            <div className="top-rated-stat" aria-label={`Average rating ${Number.isFinite(rating) ? formattedRating : 'unavailable'} out of 5`}>
              <span className="top-rated-stat-label">Rating</span>
              <span className="top-rated-rating-value">
                {formattedRating}
                <img src="/images/vinyl.png" alt="" />
              </span>
            </div>
            <div className="top-rated-stat" aria-label={`${Number.isFinite(reviewCount) ? reviewCount : 'Unknown'} reviews`}>
              <span className="top-rated-stat-label">Review Count</span>
              <span className="top-rated-count">{formattedCount}</span>
            </div>
          </Link>
        )}
    </div>
  )
}

function AlbumResult({ album }) {
  const title = album.title || album.name || 'Unknown album'
  const artist = displayArtist(album) || 'Unknown artist'
  return (
    <Link className="search-result-card album-result-card" to={album.mbid ? `/albums/${encodeURIComponent(album.mbid)}` : '/'} onClick={(event) => { if (!album.mbid) event.preventDefault() }}>
      <Artwork item={album} alt={`${title} cover`} />
      <div className="search-result-copy">
        <h3 title={title}>{title}</h3>
        <p title={artist}>{artist}</p>
        {album.year && <span className="album-year">{album.year}</span>}
      </div>
    </Link>
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
    : ['pending_sent', 'pending_received'].includes(connectionStatus)
      ? '/images/connection-pending.png'
      : '/images/connection-plus.png'
  return (
    <Link className="search-result-card user-result-card" to={username ? `/users/${encodeURIComponent(username)}` : '/'} onClick={(event) => { if (!username) event.preventDefault() }}>
      <div className="user-artwork">
        <img src={image || '/images/profile-default.png'} alt={`${name}'s profile`} onError={(event) => { event.currentTarget.src = '/images/profile-default.png' }} />
      </div>
      <div className="search-result-copy">
        <h3 title={name}>{name}</h3>
        {username && <p title={`@${username}`}>@{username}</p>}
      </div>
      <span className="user-state-icon" aria-hidden="true"><img src={stateImage} alt="" /></span>
    </Link>
  )
}

function SearchPage() {
  const token = getStoredToken()
  const inputRef = useRef(null)
  const searchRequestRef = useRef(0)
  const { items: albumResults, loading: albumLoading, loadingMore: albumLoadingMore, error: albumError, hasMore: albumHasMore, resultsRootCallback: albumResultsRoot, sentinelCallback: albumSentinel, search: searchAlbumPages, reset: resetAlbumSearch } = usePagedMusicSearch()
  const [topAlbums, setTopAlbums] = useState([])
  const [topAlbumsLoading, setTopAlbumsLoading] = useState(true)
  const [topAlbumsError, setTopAlbumsError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [activeSearchTab, setActiveSearchTab] = useState('albums')
  const [userResults, setUserResults] = useState([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    if (!token) {
      window.location.replace('/login')
      return undefined
    }

    let cancelled = false
    async function loadTopAlbums() {
      try {
        const albums = await getTopRatedAlbums(token)
        if (cancelled) return
        setTopAlbums(albums)
      } catch (error) {
        if (!cancelled) {
          if (/401|unauthorized|unauthenticated|not authenticated|credentials/i.test(error.message)) {
            clearStoredToken()
            window.location.replace('/login')
          } else setTopAlbumsError(error.message || 'Could not load top rated albums.')
        }
      } finally {
        if (!cancelled) setTopAlbumsLoading(false)
      }
    }
    loadTopAlbums()
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
    const requestId = ++searchRequestRef.current
    const term = value.trim()
    if (!term) {
      setSubmittedQuery('')
      setUserResults([])
      setSearchError('')
      setUserSearchLoading(false)
      resetAlbumSearch()
      return
    }
    setSubmittedQuery(term)
    if (tab === 'albums') {
      setUserResults([])
      resetAlbumSearch()
      searchAlbumPages(term, (value, offset, limit) => searchAlbums(value, token, limit, offset), 15)
      setUserSearchLoading(false)
      setSearchError('')
      return
    }
    setUserSearchLoading(true)
    setSearchError('')
    setUserResults([])
    try {
      const found = await searchUsers(term, token)
      if (requestId === searchRequestRef.current) setUserResults(found)
    } catch (error) {
      if (/401|unauthorized|unauthenticated|not authenticated|credentials/i.test(error.message)) {
        clearStoredToken()
        window.location.replace('/login')
        return
      }
      if (requestId === searchRequestRef.current) setSearchError(error.message || 'Search could not be completed.')
    } finally {
      if (requestId === searchRequestRef.current) setUserSearchLoading(false)
    }
  }, [activeSearchTab, query, resetAlbumSearch, searchAlbumPages, token])

  function selectSearchTab(tab) {
    setActiveSearchTab(tab)
    if (tab === 'users') resetAlbumSearch()
    if (submittedQuery) runSearch(submittedQuery, tab)
  }

  function handleSubmit(event) {
    event.preventDefault()
    runSearch(query)
    if (window.matchMedia('(max-width: 760px)').matches) inputRef.current?.blur()
  }

  function closeSearch() {
    searchRequestRef.current += 1
    setExpanded(false)
    setQuery('')
    setSubmittedQuery('')
    setUserResults([])
    setSearchError('')
    setUserSearchLoading(false)
    resetAlbumSearch()
    inputRef.current?.blur()
  }

  return (
    <main className="search-page">
      <AppHeader alwaysShowMobileNavigation />
      <section className={`search-workspace${expanded ? ' is-expanded' : ''}`}>
        <form className={`main-search-form${expanded ? ' is-expanded' : ''}`} onSubmit={handleSubmit} noValidate>
          <input
            ref={inputRef}
            aria-label="Search albums and users"
            placeholder="Search."
            value={query}
            onFocus={() => setExpanded(true)}
            onChange={(event) => { searchRequestRef.current += 1; resetAlbumSearch(); setUserResults([]); setUserSearchLoading(false); setSearchError(''); setQuery(event.target.value) }}
          />
          <button className="submit-search" type="submit" aria-label="Search"><SearchIcon /></button>
          <button className="close-search" type="button" aria-label="Clear and close search" aria-hidden={!expanded} tabIndex={expanded ? 0 : -1} onClick={closeSearch}><CloseIcon /></button>
        </form>

        <div className={`search-content-stage${expanded ? ' is-expanded' : ''}`}>
          <section className="expanded-search-panel" aria-label="Search results" aria-busy={activeSearchTab === 'albums' ? albumLoading || albumLoadingMore : userSearchLoading} aria-hidden={!expanded} inert={!expanded}>
            <div className={`search-tabs${activeSearchTab === 'users' ? ' is-users-active' : ''}`} role="tablist" aria-label="Search category">
              <button type="button" role="tab" aria-selected={activeSearchTab === 'albums'} className={activeSearchTab === 'albums' ? 'is-active' : ''} onClick={() => selectSearchTab('albums')}>Albums</button>
              <button type="button" role="tab" aria-selected={activeSearchTab === 'users'} className={activeSearchTab === 'users' ? 'is-active' : ''} onClick={() => selectSearchTab('users')}>Users</button>
            </div>
            <div className={`search-results${activeSearchTab === 'users' ? ' user-search-results' : ''}`} ref={activeSearchTab === 'albums' ? albumResultsRoot : undefined} role="tabpanel">
              {activeSearchTab === 'albums' && albumLoading && <p className="search-message is-loading" role="status">{albumError || 'Searching albums…'}</p>}
              {activeSearchTab === 'albums' && !albumLoading && !albumLoadingMore && albumError && <p className="search-message is-error" role="alert">{albumError}</p>}
              {activeSearchTab === 'users' && userSearchLoading && <p className="search-message is-loading" role="status">Searching…</p>}
              {activeSearchTab === 'users' && searchError && !userSearchLoading && <p className="search-message is-error" role="alert">{searchError}</p>}
              {activeSearchTab === 'users' && !userSearchLoading && !searchError && submittedQuery && userResults.length === 0 && <p className="search-message" role="status">No users found for “{submittedQuery}”.</p>}
              {!albumLoading && activeSearchTab === 'albums' && albumResults.map((result, index) => <AlbumResult key={result.mbid || result.id || index} album={result} />)}
              {activeSearchTab === 'users' && userResults.map((result, index) => <UserResult key={result.id || result.user_id || result.username || index} user={result} token={token} />)}
              {activeSearchTab === 'albums' && albumLoadingMore && <div className="search-load-more" role="status">
                <span>Loading more albums…</span>
                <span className="search-load-more__track" role="progressbar" aria-label="Loading more albums"><span /></span>
              </div>}
              {activeSearchTab === 'albums' && albumHasMore && <div className="search-page-sentinel" ref={albumSentinel} aria-hidden="true" />}
            </div>
          </section>
          <section className="top-rated-board" aria-label="Top rated albums on Mayomix" aria-busy={topAlbumsLoading} aria-hidden={expanded} inert={expanded}>
            <h1>Top rated albums on Mayomix</h1>
            <div className="top-rated-list">
              {topAlbumsLoading && <p className="search-message" role="status">Loading top rated albums…</p>}
              {topAlbumsError && !topAlbumsLoading && <p className="search-message is-error" role="alert">{topAlbumsError}</p>}
              {!topAlbumsLoading && !topAlbumsError && topAlbums.length === 0 && <p className="search-message" role="status">No album ratings yet.</p>}
              {!topAlbumsLoading && !topAlbumsError && topAlbums.map((entry, index) => (
                <TopRatedAlbumCard key={entry.mbid || index} entry={entry} rank={index + 1} token={token} />
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default SearchPage
