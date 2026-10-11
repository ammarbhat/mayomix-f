import { useEffect, useRef, useState } from 'react'
import { apiRequest, getAlbumDetails, getUserReviews } from './api.js'
import AppHeader from './AppHeader.jsx'
import RatingVinyls from './RatingVinyls.jsx'
import './UserReviewsPage.css'

function UserReviewCard({ review }) {
  const cardRef = useRef(null)
  const [album, setAlbum] = useState(review.album || null)
  const [imageError, setImageError] = useState(false)
  const mbid = review.mbid || review.album_mbid || album?.mbid || ''

  useEffect(() => {
    if (!mbid || album?.title) return undefined
    let cancelled = false
    let requested = false
    async function loadAlbum() {
      if (requested) return
      requested = true
      try {
        const metadata = await getAlbumDetails(mbid)
        if (!cancelled && metadata.title && metadata.title !== mbid) setAlbum(metadata)
      } catch {
        // Keep the review visible even when album metadata is unavailable.
      }
    }
    const node = cardRef.current
    if (!node || !('IntersectionObserver' in window)) {
      loadAlbum()
      return () => { cancelled = true }
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect()
        loadAlbum()
      }
    }, { rootMargin: '180px' })
    observer.observe(node)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [album?.title, mbid])

  const title = album?.title || review.album_title || 'Album'
  const artistCredits = album?.['artist-credit'] || []
  const artist = album?.artist || (Array.isArray(artistCredits)
    ? artistCredits.map((credit) => `${credit.name || credit.artist?.name || ''}${credit.joinphrase || ''}`).join('').trim()
    : '')
  const image = !imageError && (album?.image || (mbid ? `https://coverartarchive.org/release-group/${encodeURIComponent(mbid)}/front-250` : ''))

  return (
    <article className="user-review-card" ref={cardRef}>
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
  useEffect(() => {
    let cancelled = false
    async function loadReviews() {
      setLoading(true)
      setError('')
      try {
        await apiRequest(`/users/${encodeURIComponent(username)}`)
        let result = []
        try {
          result = await getUserReviews(username)
        } catch (requestError) {
          if (!/404|not found/i.test(requestError.message)) throw requestError
        }
        if (!cancelled) setReviews(result)
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
          {loading && <p className="user-reviews-message" role="status">Loading reviews…</p>}
          {error && !loading && <p className="user-reviews-message is-error" role="alert">{error}</p>}
          {!loading && !error && reviews.length === 0 && <p className="user-reviews-message">No reviews yet.</p>}
          {!loading && !error && reviews.length > 0 && <div className="user-reviews-grid">
            {reviews.map((review, index) => <UserReviewCard key={review.id || review.review_id || `${review.mbid}-${index}`} review={review} />)}
          </div>}
        </section>
      </div>
    </main>
  )
}

export default UserReviewsPage
