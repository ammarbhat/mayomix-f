import { useEffect, useState } from 'react'
import { apiRequest, clearStoredToken, getConnectionStatus, getStoredToken, getTasteList, itemDetails, sendConnectionRequest } from './api.js'
import RatingVinyls from './RatingVinyls.jsx'
import MetadataBuffering from './MetadataBuffering.jsx'
import AppHeader from './AppHeader.jsx'
import './ProfilePage.css'

const emptyProfile = { user: null, userId: null, topAlbums: [], songs: [], rotationAlbums: [], genres: [], artists: [] }
const itemNeedsMetadata = (entry) => {
  const item = itemDetails(entry)
  return Boolean(item.metadataLoading || (item.mbid && item.title === item.mbid && !item.metadataLoaded))
}

function PlaceholderCards({ count = 3, className = '' }) {
  return Array.from({ length: count }, (_, index) => (
    <div className={`placeholder-card ${className}`} key={`placeholder-${index}`} aria-hidden="true">
      <div className="placeholder-square" />
    </div>
  ))
}

function Artwork({ item, className = '', kind = 'album' }) {
  const [loadedImage, setLoadedImage] = useState('')
  const [failedImage, setFailedImage] = useState('')
  const details = itemDetails(item)
  const metadataPending = Boolean(details.metadataLoading)
  const imagePending = Boolean(details.image && details.image !== loadedImage && details.image !== failedImage)
  const isLoading = metadataPending || imagePending
  return (
    <div className={`artwork ${className}`} aria-busy={isLoading}>
      {details.image && <img className={`image-fade${loadedImage === details.image ? ' is-loaded' : ''}`} src={details.image} alt={`${details.title && details.title !== details.mbid ? details.title : kind} artwork`} loading="lazy" onLoad={() => setLoadedImage(details.image)} onError={() => setFailedImage(details.image)} />}
      {isLoading
        ? <span className="profile-art-buffering" role="status" aria-label={`Loading ${kind} artwork`} />
        : !details.image || failedImage === details.image
          ? <span className="profile-art-fallback" aria-hidden="true">♫</span>
          : null}
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
          const titleIsMbid = Boolean(item.mbid && item.title === item.mbid)
          const titlePending = Boolean(item.metadataLoading || (titleIsMbid && !item.metadataLoaded))
          const displayTitle = titlePending
            ? ''
            : titleIsMbid
              ? `${type === 'song' ? 'Song' : 'Album'} details unavailable`
              : item.title || (type === 'song' ? 'Unknown song' : 'Untitled')
          return (
            <a className="media-card" key={item.mbid || `${item.title}-${index}`} href={type === 'top-album' && item.mbid ? `/albums/${encodeURIComponent(item.mbid)}` : undefined}>
              <Artwork item={item} kind={type === 'song' ? 'song' : 'album'} />
              <div className="media-copy">
                <h3 title={titleIsMbid ? undefined : displayTitle}>{displayTitle}</h3>
                {type === 'song' && <p title={item.artist}>{item.artist || item.album || ''}</p>}
              </div>
              {(type === 'top-album' || type === 'rotation') ? <RatingVinyls item={entry} size="large" /> : null}
            </a>
          )
        })}
        <PlaceholderCards count={Math.max(0, 3 - items.length)} className={`${type}-placeholder`} />
      </div>
    </section>
  )
}

function ProfilePage({ username: viewedUsername = '' }) {
  const isPublicProfile = Boolean(viewedUsername)
  const [profile, setProfile] = useState(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('')
  const [connectionBusy, setConnectionBusy] = useState(false)
  const [connectionError, setConnectionError] = useState('')
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
        const currentUser = await apiRequest('/users/me', { token })
        if (isPublicProfile && currentUser.username === viewedUsername) {
          window.location.replace('/profile')
          return
        }
        const user = isPublicProfile
          ? await apiRequest(`/users/${encodeURIComponent(viewedUsername)}`)
          : currentUser
        const categories = ['top_albums', 'rotation_song', 'rotation_album', 'top_artists', 'top_genres']
        const enrichmentUpdates = {}
        const profileKeyByCategory = { top_albums: 'topAlbums', rotation_song: 'songs', rotation_album: 'rotationAlbums', top_artists: 'artists' }
        const requests = categories.map((category) => getTasteList(user.username, category, token, (items) => {
          enrichmentUpdates[category] = items
          if (cancelled) return
          setProfile((current) => current.user
            ? { ...current, [profileKeyByCategory[category] || category]: items }
            : current)
        }))
        if (isPublicProfile) requests.push(getConnectionStatus(user.username, token))
        const results = await Promise.allSettled(requests)
        if (cancelled) return

        const taste = Object.fromEntries(categories.map((category, index) => [
          category,
          results[index].status === 'fulfilled' ? results[index].value : [],
        ]))
        const savedGenres = Array.isArray(user.fav_genres) ? user.fav_genres.map(itemDetails).map((item) => item.title).filter(Boolean) : []
        const tasteUserId = results.slice(0, categories.length)
          .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
          .find((entry) => entry.user_id != null)?.user_id
        setProfile({
          user,
          userId: user.id ?? tasteUserId ?? null,
          topAlbums: enrichmentUpdates.top_albums || taste.top_albums,
          songs: enrichmentUpdates.rotation_song || taste.rotation_song,
          rotationAlbums: enrichmentUpdates.rotation_album || taste.rotation_album,
          artists: enrichmentUpdates.top_artists || taste.top_artists,
          genres: savedGenres.length ? savedGenres : taste.top_genres,
        })
        if (isPublicProfile) {
          const connectionResult = results[categories.length]
          setConnectionStatus(connectionResult.status === 'fulfilled' ? connectionResult.value : '')
        }
        const hasTasteLoadError = results.slice(0, categories.length).some((result) => result.status === 'rejected' && !/404|not found/i.test(result.reason?.message || ''))
        if (hasTasteLoadError) setError('Some taste lists could not be loaded.')
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
  }, [isPublicProfile, token, viewedUsername])

  async function connect() {
    setConnectionBusy(true)
    setConnectionError('')
    try {
      await sendConnectionRequest(token, user.id ?? profile.userId)
      setConnectionStatus('pending_sent')
    } catch (requestError) {
      if (/409|already exists/i.test(requestError.message)) {
        try {
          setConnectionStatus(await getConnectionStatus(user.username, token))
          return
        } catch {
          // Keep the original request error visible when refreshing status also fails.
        }
      }
      setConnectionError(requestError.message || 'Could not send the connection request.')
    } finally {
      setConnectionBusy(false)
    }
  }

  if (!token) return null

  const user = profile.user || {}
  const handle = user.username || user.handle || user.name || 'listener'
  const bio = user.bio || user.biography || user.about || ''
  const usesAlbumArtwork = /coverartarchive\.org/i.test(user.pfp_link || '')
  const artistMetadataPending = profile.artists.some(itemNeedsMetadata)
  const mediaMetadataPending = [profile.topAlbums, profile.songs, profile.rotationAlbums, profile.artists].some((items) => items.some(itemNeedsMetadata))

  return (
    <main className={`profile-page${isPublicProfile ? ' public-profile-page' : ''}`} id="profile">
      <AppHeader />
      <div className="profile-wrap">
        <section className="profile-board" aria-label={isPublicProfile ? `${user.name || handle}'s music profile` : 'Your music profile'}>
          <aside className="profile-sidebar" aria-busy={loading}>
            <section className={`identity-panel${isPublicProfile ? ' public-identity-panel' : ''}`}>
              <div className="identity-heading">
                {usesAlbumArtwork
                  ? <img className="identity-album-art" src={user.pfp_link} alt={`${user.name || handle}'s selected album artwork`} onError={(event) => { event.currentTarget.src = '/images/profile-default.png' }} />
                  : <div className="profile-turntable" aria-label="Profile photo on a record player">
                    <img className="turntable-base" src="/images/turntable-white-platter.png" alt="" />
                    <img className="turntable-profile" src={user.pfp_link || '/images/profile-default.png'} alt={`${user.name || handle}'s profile picture`} onError={(event) => { if (!event.currentTarget.src.endsWith('/images/profile-default.png')) event.currentTarget.src = '/images/profile-default.png' }} />
                  </div>}
                <div className="identity-copy">
                  <h1>{loading && !user.name ? <span className="text-skeleton name-skeleton" aria-label="Loading profile" /> : user.name || 'Your profile'}</h1>
                  <p className="identity-handle">{loading && !user.username ? <span className="text-skeleton handle-skeleton" aria-label="Loading username" /> : `@${handle}`}</p>
                  {!isPublicProfile && <div className="profile-edit-actions"><a href="/settings/edit-profile">Edit Profile</a><a href="/taste">Edit Display</a><a href="/settings">Settings</a></div>}
                </div>
              </div>
              <p className="identity-bio">{loading && !bio ? <span className="text-skeleton bio-skeleton" aria-label="Loading bio" /> : bio}</p>
              {isPublicProfile && <>
                <ConnectionButton status={connectionStatus} loading={connectionBusy || loading} onClick={connect} />
                {connectionError && <p className="connection-error" role="alert">{connectionError}</p>}
              </>}
            </section>
            <section className="details-panel" aria-label={isPublicProfile ? `${handle}'s favorites` : 'Your favorites'}>
              <div className="identity-section favorite-card genre-card">
                <h2>Top Genres</h2>
                <div className="identity-list genre-list">
                  {loading && profile.genres.length === 0 && <span className="list-skeleton" aria-label="Loading genres" />}
                  {profile.genres.slice(0, 5).map((genre, index) => <span key={`${itemDetails(genre).title}-${index}`}>{itemDetails(genre).title}</span>)}
                  {!loading && profile.genres.length === 0 && <span className="muted-placeholder">No genres yet</span>}
                </div>
              </div>
              <div className="identity-section favorite-card artist-card">
                <h2>Top Artists</h2>
                <div className="identity-list artist-list">
                  {loading && profile.artists.length === 0 && <span className="list-skeleton" aria-label="Loading artists" />}
                  {!artistMetadataPending && profile.artists.slice(0, 4).map((artist, index) => {
                    const details = itemDetails(artist)
                    return <span key={`${details.mbid || details.title}-${index}`}>{details.title}</span>
                  })}
                  {!loading && profile.artists.length === 0 && <span className="muted-placeholder">No artists yet</span>}
                </div>
              </div>
            </section>
          </aside>

          <a className="public-reviews-link" href={`/users/${encodeURIComponent(user.username || viewedUsername || handle)}/reviews`}>Reviews</a>

          <div className="listening-panel">
            {(loading || mediaMetadataPending) ? <div className="profile-metadata-loading"><MetadataBuffering label="Loading profile music details" /></div> : <>
              <MediaSection id="top-albums" title="Top Albums" items={profile.topAlbums} loading={loading} type="top-album" />
              <MediaSection id="rotation" title="Rotation" items={profile.rotationAlbums} loading={loading} type="rotation" />
              <MediaSection id="songs" title="Songs" items={profile.songs} loading={loading} type="song" />
            </>}
            {error && <p className="profile-status" role="status">{error}</p>}
          </div>
        </section>
      </div>
    </main>
  )
}

function ConnectionButton({ status, loading, onClick }) {
  const states = {
    not_found: { label: 'Connect', asset: '/images/connection-plus.png', canConnect: true },
    pending_sent: { label: 'Sent', asset: '/images/connection-pending.png' },
    pending_received: { label: 'Pending', asset: '/images/connection-pending.png' },
    connected: { label: 'Connected', asset: '/images/connection-check.png' },
  }
  const current = states[status] || states.not_found
  return (
    <button className={`connection-button${current.canConnect ? ' can-connect' : ''}`} type="button" onClick={onClick} disabled={loading || !current.canConnect} aria-label={current.canConnect ? 'Send connection request' : current.label}>
      <span>{loading ? 'Loading' : current.label}</span>
      <img src={current.asset} alt="" />
    </button>
  )
}

export default ProfilePage
