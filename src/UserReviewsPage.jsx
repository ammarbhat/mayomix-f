import { useEffect, useState } from 'react'
import { apiRequest, getAlbumDetails, getStoredToken, getUserReviews } from './api.js'
import AppHeader from './AppHeader.jsx'
import RatingVinyls from './RatingVinyls.jsx'
import MetadataBuffering from './MetadataBuffering.jsx'
import ReviewActions from './ReviewActions.jsx'
import './UserReviewsPage.css'

function UserReviewCard({ review, canEdit, token, onSaved, onDeleted }) {
  const album = review.album || null
  const [imageError, setImageError] = useState(false)
  const mbid = review.mbid || review.album_mbid || album?.mbid || ''

  const titleValue = [album?.title, review.album_title, review.title].find((value) => value && value !== mbid) || ''
  const title = titleValue || 'Album'
  const artistCredits = album?.['artist-credit'] || []
  const artist = album?.artist || (Array.isArray(artistCredits)
    ? artistCredits.map((credit) => `${credit.name || credit.artist?.name || ''}${credit.joinphrase || ''}`).join('').trim()
    : '')
  const image = !imageError && (album?.image || (mbid ? `https://coverartarchive.org/release-group/${encodeURIComponent(mbid)}/front-250` : ''))

  return (
    <article className="user-review-card">
      {canEdit && <ReviewActions review={review} token={token} onSaved={onSaved} onDeleted={onDeleted} />}
      <div className="user-review-top">
        <div className="user-review-artwork">
          <span aria-hidden="true">♪</span>
          {image && <img src={image} alt={`${title} cover`} loading="lazy" onError={() => setImageError(true)} />}
        </div>
        <div className="user-review-meta">
          <h3 title={title}>{title}</h3>
          {artist && <p title={artist}>{artist}</p>}
          <RatingVinyls className="user-review-rating" rating={review.rating} />
        </div>
      </div>
      <div className="user-review-divider" />
      <p className="user-review-text">{review.review_str || review.review_text || review.text || ''}</p>
    </article>
  )
}

function UserReviewsPage({ username }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUsername, setCurrentUsername] = useState('')
  const token = getStoredToken()
  useEffect(() => {
    let cancelled = false
    async function loadReviews() {
      setLoading(true)
      setError('')
      try {
        const authToken = getStoredToken()
        const me = authToken ? await apiRequest('/users/me', { token: authToken }).catch(() => null) : null
        if (!cancelled) setCurrentUsername(me?.username || '')
        await apiRequest(`/users/${encodeURIComponent(username)}`)
        let result = []
        try {
          result = await getUserReviews(username)
        } catch (requestError) {
          if (!/404|not found/i.test(requestError.message)) throw requestError
        }
        const withMetadata = await Promise.all(result.map(async (review) => {
          const album = review.album || review.album_info || review.metadata || {}
          const mbid = review.album_mbid || review.mbid || album.mbid || album.id || ''
          const title = album.title || review.album_title || review.title
          const artist = album.artist || review.artist || review.artist_name
          if (!mbid || (title && artist)) return { ...review, metadataLookupComplete: true }
          try {
            const metadata = await getAlbumDetails(mbid)
            return { ...review, album: { ...album, ...metadata }, metadataLookupComplete: true }
          } catch {
            return { ...review, metadataLookupComplete: true }
          }
        }))
        if (!cancelled) setReviews(withMetadata)
      } catch (requestError) {
        if (cancelled) return
        setError(requestError.message || 'Could not load reviews.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadReviews()
    return () => { cancelled = true }
  }, [username])

  return (
    <main className="user-reviews-page">
      <AppHeader />
      <div className="user-reviews-wrap">
        <section className="user-reviews-board" aria-busy={loading} aria-label={`${username}'s reviews`}>
          <header className="user-reviews-heading"><h1>Reviews</h1></header>
          {loading && <div className="user-reviews-metadata-loading"><MetadataBuffering label="Loading review details" /></div>}
          {error && !loading && <p className="user-reviews-message is-error" role="alert">{error}</p>}
          {!loading && !error && reviews.length === 0 && <p className="user-reviews-message">No reviews yet.</p>}
          {!loading && !error && reviews.length > 0 && <div className="user-reviews-grid">
            {reviews.map((review, index) => <UserReviewCard key={review.id || review.review_id || `${review.mbid}-${index}`} review={review} canEdit={Boolean(currentUsername && currentUsername === username)} token={token} onSaved={(updated) => setReviews((items) => items.map((item) => String(item.id || item.review_id) === String(updated.id || updated.review_id) ? updated : item))} onDeleted={(removed) => setReviews((items) => items.filter((item) => String(item.id || item.review_id) !== String(removed.id || removed.review_id)))} />)}
          </div>}
        </section>
      </div>
    </main>
  )
}

export default UserReviewsPage
