import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { apiRequest, clearStoredToken, createAlbumReview, getAlbumDetails, getAlbumReviews, getStoredToken, getUserReviews, itemDetails } from '../../api/api.js'
import AppHeader from '../../components/layout/AppHeader.jsx'
import MetadataBuffering from '../../components/feedback/MetadataBuffering.jsx'
import RatingVinyls from '../../components/ratings/RatingVinyls.jsx'
import ReviewActions from '../../components/reviews/ReviewActions.jsx'
import './AlbumReviewsPage.css'

function AlbumReviewCard({ review, isOwnReview, currentUsername, token, onSaved, onDeleted }) {
  const username = review.username || review.user?.username || review.reviewer?.username || review.author?.username || (isOwnReview ? currentUsername : '') || 'listener'
  return <article className="album-review-card">
    {isOwnReview && <ReviewActions review={review} token={token} onSaved={onSaved} onDeleted={onDeleted} />}
    <div className="album-review-card-top">
      <span>@{username}</span>
      <RatingVinyls className="album-review-card-rating" size="large" rating={review.rating} />
    </div>
    <p>{review.review_str || review.review_text || review.text || ''}</p>
  </article>
}

function AlbumReviewsPage() {
  const { mbid } = useParams()
  const token = getStoredToken()
  const [album, setAlbum] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewsError, setReviewsError] = useState('')
  const [currentUsername, setCurrentUsername] = useState('')
  const [ownReview, setOwnReview] = useState(null)
  const [reviewCheck, setReviewCheck] = useState('checking')
  const [composerOpen, setComposerOpen] = useState(false)
  const [reviewText, setReviewText] = useState('')
  const [rating, setRating] = useState(0)
  const [posting, setPosting] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!token) { window.location.replace('/login'); return undefined }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      setReviewsError('')
      setOwnReview(null)
      setReviewCheck('checking')
      setComposerOpen(false)
      try {
        const [albumResult, reviewsResult, profileResult] = await Promise.allSettled([
          getAlbumDetails(mbid, token),
          getAlbumReviews(mbid, token),
          apiRequest('/users/me', { token }),
        ])
        if (albumResult.status === 'rejected') throw albumResult.reason
        if (cancelled) return
        setAlbum(albumResult.value)
        if (reviewsResult.status === 'fulfilled') setReviews(reviewsResult.value)
        else {
          setReviews([])
          setReviewsError(reviewsResult.reason?.message || 'Reviews could not be loaded.')
        }

        if (profileResult.status === 'fulfilled') {
          const username = profileResult.value.username || ''
          setCurrentUsername(username)
          try {
            let matchingReview = null
            let offset = 0
            const pageSize = 29
            while (!matchingReview) {
              const ownReviews = await getUserReviews(username, token, pageSize, offset).catch((reviewError) => {
                if (reviewError.status === 404 || /404|not found/i.test(reviewError.message)) return []
                throw reviewError
              })
              if (cancelled) return
              matchingReview = ownReviews.find((review) => String(review.mbid || review.album_mbid || review.album?.mbid || '') === String(mbid)) || null
              if (ownReviews.length < pageSize) break
              offset += pageSize
            }
            setOwnReview(matchingReview)
            setReviewCheck(matchingReview ? 'reviewed' : 'available')
          } catch {
            if (!cancelled) setReviewCheck('error')
          }
        } else setReviewCheck('error')
      } catch (requestError) {
        if (cancelled) return
        if (/401|unauthorized|unauthenticated|not authenticated|credentials/i.test(requestError.message)) {
          clearStoredToken()
          window.location.replace('/login')
        } else setError(requestError.message || 'Could not load this album.')
      } finally {
        if (!cancelled) setLoading(false)
      }
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
      setOwnReview(updated.find((review) => (review.username || review.user?.username || review.reviewer?.username || review.author?.username) === currentUsername) || null)
      setReviewCheck('reviewed')
      setReviewText('')
      setComposerOpen(false)
      setNotice('Your review was posted.')
    } catch (requestError) {
      setNotice(/409|already/i.test(requestError.message) ? 'You have already reviewed this album.' : requestError.message || 'Could not post your review.')
    } finally { setPosting(false) }
  }

  function updateOwnReview(updated) {
    const sameReview = (candidate) => String(candidate.id || candidate.review_id) === String(updated.id || updated.review_id)
    setOwnReview(updated)
    setReviews((current) => current.map((review) => sameReview(review) ? updated : review))
  }

  function removeOwnReview(removed) {
    const sameReview = (candidate) => String(candidate.id || candidate.review_id) === String(removed.id || removed.review_id)
    setReviews((current) => current.filter((review) => !sameReview(review)))
    setOwnReview(null)
    setReviewCheck('available')
    setNotice('Your review was deleted.')
  }

  const details = itemDetails(album || {})
  const title = details.title && details.title !== mbid ? details.title : 'Album'
  const displayedReviews = [...reviews]
  if (ownReview && !displayedReviews.some((review) => String(review.id || review.review_id) === String(ownReview.id || ownReview.review_id))) displayedReviews.unshift(ownReview)

  return <main className="album-reviews-page">
    <AppHeader />
    <div className="album-reviews-wrap">
      <section className="album-reviews-board" aria-busy={loading} aria-label={`${title} reviews`}>
        <header className="album-reviews-heading">
          <Link className="album-reviews-back" to={`/albums/${encodeURIComponent(mbid)}`} aria-label={`Back to ${title}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6" /></svg>
          </Link>
          <h1>Reviews</h1>
        </header>
        {loading && <div className="album-reviews-loading"><MetadataBuffering label="Loading album reviews" /></div>}
        {error && !loading && <p className="album-reviews-message is-error" role="alert">{error}</p>}
        {!loading && !error && <>
          {reviewCheck === 'available' && <button className="album-review-compose-trigger" type="button" aria-expanded={composerOpen} onClick={() => { setComposerOpen((open) => !open); setNotice('') }}>{composerOpen ? 'Close review' : 'Write a review'}</button>}
          {reviewCheck === 'available' && composerOpen && <form className="album-reviews-composer" onSubmit={submitReview} noValidate>
            <textarea className="resize-none" maxLength={400} value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder="What do you think of this album?" aria-label="Your album review" />
            <div className="album-reviews-composer-footer">
              <div className="album-reviews-rating" role="group" aria-label={`Rating: ${rating} out of 10`}>
                {Array.from({ length: 5 }, (_, index) => {
                  const fullValue = (index + 1) * 2
                  const state = rating >= fullValue ? 'full' : rating === fullValue - 1 ? 'half' : 'empty'
                  const nextRating = state === 'empty' ? fullValue : state === 'full' ? fullValue - 1 : 0
                  return <button key={index} type="button" className={`album-reviews-vinyl is-${state}`} aria-label={`Set rating to ${nextRating} out of 10`} aria-pressed={state !== 'empty'} onClick={() => setRating(nextRating)}>
                    <img className="album-reviews-vinyl-empty" src="/images/vinyl.png" alt="" />
                    {state === 'full' && <img className="album-reviews-vinyl-fill" src="/images/vinyl.png" alt="" />}
                    {state === 'half' && <img className="album-reviews-vinyl-fill is-half" src="/images/vinyl-half.png" alt="" />}
                  </button>
                })}
              </div>
              <button className="album-reviews-post" type="submit" disabled={posting}>{posting ? 'Posting…' : 'Post'}</button>
            </div>
            {notice && <p className="album-reviews-notice" role="status">{notice}</p>}
          </form>}
          {notice && !composerOpen && <p className="album-reviews-notice" role="status">{notice}</p>}
          {reviewsError && <p className="album-reviews-message" role="status">Reviews are temporarily unavailable.</p>}
          {!reviewsError && displayedReviews.length === 0 && <p className="album-reviews-message">No reviews yet. Start the conversation.</p>}
          {!reviewsError && displayedReviews.length > 0 && <div className="album-reviews-list">
            {displayedReviews.map((review, index) => {
              const isOwnReview = Boolean(ownReview && String(review.id || review.review_id) === String(ownReview.id || ownReview.review_id))
              return <AlbumReviewCard key={review.id || review.review_id || index} review={review} isOwnReview={isOwnReview} currentUsername={currentUsername} token={token} onSaved={updateOwnReview} onDeleted={removeOwnReview} />
            })}
          </div>}
        </>}
      </section>
    </div>
  </main>
}

export default AlbumReviewsPage
