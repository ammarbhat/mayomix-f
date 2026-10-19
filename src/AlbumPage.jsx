import { useEffect, useState } from 'react'
import AppHeader from './AppHeader.jsx'
import { apiRequest, clearStoredToken, createAlbumReview, getAlbumDetails, getAlbumReviews, getStoredToken, getUserReviews, getAlbumTracklist, itemDetails } from './api.js'
import RatingVinyls from './RatingVinyls.jsx'
import MetadataBuffering from './MetadataBuffering.jsx'
import './AlbumPage.css'

function AlbumPage({ mbid }) {
  const token = getStoredToken()
  const [album, setAlbum] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [tracklistLoading, setTracklistLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewsError, setReviewsError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [reviewCheck, setReviewCheck] = useState('checking')
  const [reviewText, setReviewText] = useState('')
  const [rating, setRating] = useState(0)
  const [posting, setPosting] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!token) { window.location.replace('/login'); return undefined }
    let cancelled = false
    async function load() {
      setLoading(true)
      setTracklistLoading(true)
      setError('')
      setReviewCheck('checking')
      setComposerOpen(false)
      try {
        const [detailsResult, reviewsResult, profileResult] = await Promise.allSettled([
          getAlbumDetails(mbid, token),
          getAlbumReviews(mbid, token),
          apiRequest('/users/me', { token }),
        ])
        if (detailsResult.status === 'rejected') throw detailsResult.reason
        const details = detailsResult.value
        if (cancelled) return
        setAlbum(details)
        setLoading(false)
        if (reviewsResult.status === 'fulfilled') {
          setReviews(reviewsResult.value)
          setReviewsError('')
        } else {
          setReviews([])
          setReviewsError(reviewsResult.reason?.message || 'Reviews could not be loaded.')
        }
        if (profileResult.status === 'fulfilled') {
          try {
            let hasReviewed = false
            let offset = 0
            const pageSize = 29
            while (!hasReviewed) {
              const ownReviews = await getUserReviews(profileResult.value.username, token, pageSize, offset).catch((reviewError) => {
                if (reviewError.status === 404 || /404|not found/i.test(reviewError.message)) return []
                throw reviewError
              })
              if (cancelled) return
              hasReviewed = ownReviews.some((review) => String(review.mbid || review.album_mbid || review.album?.mbid || '') === String(mbid))
              if (ownReviews.length < pageSize) break
              offset += pageSize
            }
            setReviewCheck(hasReviewed ? 'reviewed' : 'available')
            if (!hasReviewed && window.matchMedia('(max-width: 760px)').matches) setComposerOpen(true)
          } catch {
            if (!cancelled) setReviewCheck('error')
          }
        } else {
          setReviewCheck('error')
        }
        const tracklist = await getAlbumTracklist(mbid, details).catch(() => [])
        if (cancelled) return
        setAlbum((current) => ({ ...current, tracks: tracklist }))
        setTracklistLoading(false)
      } catch (requestError) {
        if (!cancelled) {
          if (/401|unauthorized|unauthenticated|not authenticated|credentials/i.test(requestError.message)) {
            clearStoredToken()
            window.location.replace('/login')
          } else setError(requestError.message || 'Could not load this album.')
        }
      } finally { if (!cancelled) { setLoading(false); setTracklistLoading(false) } }
    }
    load()
    return () => { cancelled = true }
  }, [mbid, token])

  async function submitReview(event) {
    event.preventDefault()
    if (!reviewText.trim()) { setNotice('Write a few words about the album first.'); return }
    if (!rating) { setNotice('Choose a vinyl rating first.'); return }
    setPosting(true)
    setNotice('')
    try {
      await createAlbumReview(mbid, reviewText.trim(), rating, token)
      const updated = await getAlbumReviews(mbid, token)
      setReviews(updated)
      setReviewCheck('reviewed')
      setReviewText('')
      setComposerOpen(false)
      setNotice('Your review was posted.')
    } catch (requestError) {
      setNotice(/409|already/i.test(requestError.message) ? 'You have already reviewed this album.' : requestError.message || 'Could not post your review.')
    } finally { setPosting(false) }
  }

  const details = itemDetails(album || {})
  const title = details.title && details.title !== mbid ? details.title : 'Album'
  const artistCredits = album?.['artist-credit'] || []
  const artist = details.artist || (Array.isArray(artistCredits) ? artistCredits.map((credit) => `${credit.name || credit.artist?.name || ''}${credit.joinphrase || ''}`).join('').trim() : '')
  const year = album?.['first-release-date']?.slice(0, 4) || album?.year || ''
  const genre = album?.genres?.[0]?.name || 'Pop'
  const tracks = album?.tracks || album?.tracklist || album?.media?.flatMap((medium) => medium.tracks || []) || []

  return <main className="album-page">
      <AppHeader />
    <div className="album-page-wrap">
      <section className="album-board" aria-busy={loading}>
        {error && <p className="album-page-message is-error" role="alert">{error}</p>}
        <section className="album-left-column" aria-label={`${title} album details`}>
          {(loading || tracklistLoading) ? <div className="album-metadata-loading"><MetadataBuffering label="Loading album and track details" /></div> : <>
          <div className="album-summary">
            <div className="album-cover">{(album?.cover_url || details.image) && <img src={album.cover_url || details.image} alt={`${title} cover`} onError={(event) => event.currentTarget.remove()} />}</div>
            <h1>{title}</h1>
            <p>{artist}<span>{year ? `${genre} | ${year}` : ''}</span></p>
            {reviewCheck === 'available' && <button className="album-review-toggle album-review-toggle-desktop" type="button" aria-label={composerOpen ? 'Close review composer' : 'Write an album review'} aria-expanded={composerOpen} onClick={() => { setComposerOpen((open) => !open); setNotice('') }}><span>{composerOpen ? '×' : '+'}</span></button>}
          </div>
          <div className="album-track-heading">Tracklist</div>
          <div className="album-track-panel">
            {tracks.length ? <ol>{tracks.map((track, index) => <li key={track.id || `${track.title}-${index}`}>{track.title || track.recording?.title || `Track ${index + 1}`}</li>)}</ol> : <p className="album-no-tracks">Tracklist unavailable.</p>}
            <span className="album-down-mark" aria-hidden="true">⌄</span>
          </div>
          {reviewCheck === 'available' && <button className="album-review-toggle album-review-toggle-mobile" type="button" aria-label={composerOpen ? 'Close review composer' : 'Write an album review'} aria-expanded={composerOpen} onClick={() => { setComposerOpen((open) => !open); setNotice('') }}>Reviews</button>}
          </>}
        </section>
        {reviewCheck === 'available' && composerOpen && <form className="album-review-composer" onSubmit={submitReview}>
            <button className="composer-close" type="button" aria-label="Close review composer" onClick={() => setComposerOpen(false)}>×</button>
            <textarea maxLength={400} value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder="What do you think of this album?" aria-label="Your album review" />
            <div className="composer-footer">
              <div className="composer-rating" aria-label="Album rating">
                {Array.from({ length: 5 }, (_, index) => {
                  const fullValue = (index + 1) * 2
                  const state = rating >= fullValue ? 'full' : rating === fullValue - 1 ? 'half' : 'empty'
                  const nextState = state === 'empty' ? 'full' : state === 'full' ? 'half' : 'reset'
                  const nextRating = state === 'empty' ? fullValue : state === 'full' ? fullValue - 1 : 0
                  return <button key={index} type="button" className={`vinyl-rating-button is-${state}`} aria-label={`${index + 1}${state === 'full' ? ' full' : state === 'half' ? ' half' : ''} vinyl${state === 'empty' ? '' : `, ${rating} out of 10 total`}. Click to ${nextState === 'reset' ? 'reset rating' : `set ${nextRating} out of 10`}`} aria-pressed={state !== 'empty'} onClick={() => setRating(nextRating)}>
                    <img className="vinyl-rating-empty" src="/images/vinyl.png" alt="" />
                    {state === 'full' && <img className="vinyl-rating-fill" src="/images/vinyl.png" alt="" />}
                    {state === 'half' && <img className="vinyl-rating-fill is-half" src="/images/vinyl-half.png" alt="" />}
                  </button>
                })}
                <span>{rating ? `${rating}/10` : 'Rate'}</span>
              </div>
              <button className="composer-post" type="submit" disabled={posting}>{posting ? 'POSTING…' : 'POST'}</button>
            </div>
            {notice && <p className="composer-notice" role="status">{notice}</p>}
        </form>}
        {notice && !composerOpen && <p className="album-post-notice" role="status">{notice}</p>}
        <section className="album-reviews-panel" aria-label="Album reviews">
          {reviewsError && <p className="album-empty-reviews" role="status">Reviews are temporarily unavailable.</p>}
          {reviews.length ? reviews.map((review, index) => <article className="album-review-entry" key={review.id || review.review_id || index}>
            <span>@{review.username || review.user?.username || review.reviewer?.username || review.author?.username || 'listener'}</span>
            <p>{review.review_str || review.review_text || ''}</p>
            <RatingVinyls className="album-review-rating" size="small" rating={review.rating} />
          </article>) : !loading && !error ? <p className="album-empty-reviews">No reviews yet. Start the conversation.</p> : null}
        </section>
      </section>
    </div>
  </main>
}

export default AlbumPage
