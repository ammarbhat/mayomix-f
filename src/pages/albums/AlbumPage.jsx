import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import AppHeader from '../../components/layout/AppHeader.jsx'
import { clearStoredToken, getAlbumDetails, getStoredToken, getAlbumTracklist, itemDetails } from '../../api/api.js'
import MetadataBuffering from '../../components/feedback/MetadataBuffering.jsx'
import './AlbumPage.css'

function AlbumPage() {
  const { mbid } = useParams()
  const token = getStoredToken()
  const [album, setAlbum] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tracklistLoading, setTracklistLoading] = useState(true)
  const [error, setError] = useState('')
  const [tracklistExpanded, setTracklistExpanded] = useState(false)
  const [tracklistHeights, setTracklistHeights] = useState(null)
  const tracklistRef = useRef(null)

  useEffect(() => {
    if (!token) { window.location.replace('/login'); return undefined }
    let cancelled = false
    let tracklistPending = false
    async function load() {
      setLoading(true)
      setTracklistLoading(true)
      setError('')
      setTracklistExpanded(false)
      setTracklistHeights(null)
      try {
        const details = await getAlbumDetails(mbid, token)
        if (cancelled) return
        setAlbum(details)
        setLoading(false)
        tracklistPending = true
        getAlbumTracklist(mbid, details)
          .catch(() => [])
          .then((tracklist) => {
            if (!cancelled) setAlbum((current) => ({ ...current, tracks: tracklist }))
          })
          .finally(() => {
            if (!cancelled) setTracklistLoading(false)
          })
      } catch (requestError) {
        if (!cancelled) {
          if (/401|unauthorized|unauthenticated|not authenticated|credentials/i.test(requestError.message)) {
            clearStoredToken()
            window.location.replace('/login')
          } else setError(requestError.message || 'Could not load this album.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          if (!tracklistPending) setTracklistLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [mbid, token])

  const details = itemDetails(album || {})
  const title = details.title && details.title !== mbid ? details.title : 'Album'
  const artistCredits = album?.['artist-credit'] || album?.artist_credit || album?.meta?.['artist-credit'] || album?.meta?.artist_credit || details['artist-credit'] || details.artist_credit || []
  const creditedArtist = Array.isArray(artistCredits)
    ? artistCredits.map((credit) => {
        if (typeof credit === 'string') return credit
        return `${credit?.name || credit?.artist?.name || ''}${credit?.joinphrase || ''}`
      }).join('').trim()
    : ''
  const artist = (typeof details.artist === 'string' ? details.artist : details.artist?.name) || creditedArtist
  const year = album?.['first-release-date']?.slice(0, 4) || album?.year || ''
  const genre = (album?.genres?.[0]?.name || 'Pop').replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
  const tracks = album?.tracks || album?.tracklist || album?.media?.flatMap((medium) => medium.tracks || []) || []
  const albumMetadataLoading = loading || tracklistLoading
  const hasTracklistDisclosure = tracks.length > 13
  const tracklistId = `tracklist-${mbid}`

  useLayoutEffect(() => {
    const list = tracklistRef.current
    if (!list || tracks.length <= 13) {
      setTracklistHeights(null)
      return undefined
    }

    let frame = 0
    const measure = () => {
      const items = list.querySelectorAll('li')
      if (items.length <= 13) return
      const listTop = list.getBoundingClientRect().top
      const collapsed = Math.ceil(items[12].getBoundingClientRect().bottom - listTop)
      const expanded = Math.ceil(list.scrollHeight)
      setTracklistHeights((current) => current?.collapsed === collapsed && current?.expanded === expanded ? current : { collapsed, expanded })
    }
    const queueMeasure = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(measure)
    }
    measure()
    const observer = new ResizeObserver(queueMeasure)
    observer.observe(list)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [tracks])

  const tracklistFrameStyle = hasTracklistDisclosure && tracklistHeights
    ? { height: `${tracklistExpanded ? tracklistHeights.expanded : tracklistHeights.collapsed}px` }
    : undefined

  return <main className="album-page">
      <AppHeader />
    <div className="album-page-wrap">
      <section className="album-board" aria-busy={albumMetadataLoading}>
        {albumMetadataLoading ? <div className="album-page-loading"><MetadataBuffering label="Loading album and track details" /></div> : <>
        {error && <p className="album-page-message is-error" role="alert">{error}</p>}
        <section className="album-left-column" aria-label={`${title} album details`}>
          <div className="album-summary">
            <div className="album-cover">{details.image && <img src={details.image} alt={`${title} cover`} onError={(event) => event.currentTarget.remove()} />}</div>
            <h1>{title}</h1>
            <p>{artist}<span>{year ? `${genre} | ${year}` : ''}</span></p>
          </div>
          <div className="album-track-heading">Tracklist</div>
          <div className="album-track-panel">
            {tracks.length ? <>
              <div id={tracklistId} className={`album-tracklist-frame${tracklistExpanded ? ' is-expanded' : ''}`} style={tracklistFrameStyle}>
                <ol ref={tracklistRef}>{tracks.map((track, index) => <li key={track.id || `${track.title}-${index}`}>{track.title || track.recording?.title || `Track ${index + 1}`}</li>)}</ol>
              </div>
              {hasTracklistDisclosure && <button className="album-tracklist-toggle" type="button" aria-controls={tracklistId} aria-expanded={tracklistExpanded} onClick={() => setTracklistExpanded((expanded) => !expanded)}>
                <span className="sr-only">{tracklistExpanded ? 'Show the first 13 tracks' : `Show all ${tracks.length} tracks`}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 8 7 7 7-7" /></svg>
              </button>}
            </> : <p className="album-no-tracks">Tracklist unavailable.</p>}
          </div>
          <Link className="album-reviews-link" to={`/albums/${encodeURIComponent(mbid)}/reviews`}>Reviews</Link>
        </section>
        </>}
      </section>
    </div>
  </main>
}

export default AlbumPage
