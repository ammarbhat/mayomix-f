import { useEffect, useRef, useState } from 'react'
import { apiRequest } from './api.js'
import './ReviewActions.css'

function ReviewActions({ review, token, onSaved, onDeleted }) {
  const reviewId = review.id || review.review_id
  const menuRef = useRef(null)
  const dialogRef = useRef(null)
  const triggerRef = useRef(null)
  const [dialogMode, setDialogMode] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [rating, setRating] = useState(5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function closeOnOutsidePointer(event) {
      if (menuRef.current?.open && !menuRef.current.contains(event.target)) menuRef.current.open = false
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [])

  useEffect(() => {
    const node = dialogRef.current
    if (dialogMode && node && !node.open) node.showModal()
    if (!dialogMode && node?.open) node.close()
  }, [dialogMode])

  if (!reviewId) return null

  function openDialog(mode, trigger) {
    triggerRef.current = trigger
    setReviewText(review.review_str || review.review_text || review.text || '')
    setRating(Number(review.rating) || 5)
    setError('')
    setDialogMode(mode)
  }

  function closeDialog() {
    if (busy) return
    setDialogMode('')
    setError('')
  }

  async function saveReview(event) {
    event.preventDefault()
    if (!reviewText.trim()) { setError('Write a few words about this album first.'); return }
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/users/me/reviews/${encodeURIComponent(reviewId)}`, {
        method: 'PATCH', token, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_str: reviewText.trim(), rating }),
      })
      onSaved?.({ ...review, review_str: reviewText.trim(), rating })
      setDialogMode('')
    } catch (requestError) { setError(requestError.message || 'Could not update this review.') }
    finally { setBusy(false) }
  }

  async function deleteReview() {
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/users/me/reviews/${encodeURIComponent(reviewId)}`, { method: 'DELETE', token })
      onDeleted?.(review)
      setDialogMode('')
    } catch (requestError) { setError(requestError.message || 'Could not delete this review.') }
    finally { setBusy(false) }
  }

  return <>
    <details className="review-actions" ref={menuRef}>
      <summary aria-label="Review actions"><img src="/images/opiut.png" alt="" /></summary>
      <div className="review-actions-menu">
        <button type="button" onClick={(event) => { menuRef.current.open = false; openDialog('edit', event.currentTarget) }}><img src="/images/edit-button.png" alt="" />Edit</button>
        <button type="button" onClick={(event) => { menuRef.current.open = false; openDialog('delete', event.currentTarget) }}><img src="/images/close-button.png" alt="" />Delete</button>
      </div>
    </details>
    <dialog className={`review-actions-dialog${dialogMode === 'delete' ? ' is-confirm' : ''}`} ref={dialogRef} aria-label={dialogMode === 'edit' ? 'Edit review' : 'Delete review confirmation'} onCancel={(event) => { event.preventDefault(); closeDialog() }} onClose={() => {
      if (!dialogMode) {
        if (triggerRef.current?.isConnected) triggerRef.current.focus()
        else document.querySelector('.review-actions summary')?.focus()
      }
    }}>
      {dialogMode === 'edit' && <form className="review-actions-edit" onSubmit={saveReview} noValidate>
        <button className="review-actions-close" type="button" aria-label="Close edit review" onClick={closeDialog}><img src="/images/close-button.png" alt="" /></button>
        <textarea maxLength={400} aria-label="Your review" value={reviewText} onChange={(event) => setReviewText(event.target.value)} />
        <div className="review-actions-edit-footer">
          <div className="review-actions-rating" role="group" aria-label={`Rating: ${rating} out of 10`}>
            {Array.from({ length: 5 }, (_, index) => {
              const disc = index + 1
              const state = rating >= disc * 2 ? 'full' : rating === disc * 2 - 1 ? 'half' : 'empty'
              return <span className={`review-actions-vinyl is-${state}`} key={disc}>
                <img className="review-actions-vinyl-base" src="/images/vinyl.png" alt="" />
                {state === 'full' && <img className="review-actions-vinyl-fill" src="/images/vinyl.png" alt="" />}
                {state === 'half' && <img className="review-actions-vinyl-fill is-half" src="/images/vinyl-half.png" alt="" />}
                <button type="button" aria-label={`Rate ${disc * 2 - 1} out of 10`} aria-pressed={rating === disc * 2 - 1} onClick={() => setRating(disc * 2 - 1)} />
                <button type="button" aria-label={`Rate ${disc * 2} out of 10`} aria-pressed={rating === disc * 2} onClick={() => setRating(disc * 2)} />
              </span>
            })}
          </div>
          <div className="review-actions-dialog-buttons"><button type="button" className="review-actions-cancel" onClick={closeDialog}>Cancel</button><button type="submit" className="review-actions-post" disabled={busy}>{busy ? 'Posting…' : 'POST'}</button></div>
        </div>
        {error && <p className="review-actions-error" role="alert">{error}</p>}
      </form>}
      {dialogMode === 'delete' && <div className="review-actions-confirm">
        <p>Are you sure you want to delete this review?</p>
        {error && <p className="review-actions-error" role="alert">{error}</p>}
        <div className="review-actions-dialog-buttons"><button type="button" className="review-actions-yes" onClick={deleteReview} autoFocus disabled={busy}>{busy ? 'Deleting…' : 'Yes'}</button><button type="button" className="review-actions-no" onClick={closeDialog}>No</button></div>
      </div>}
    </dialog>
  </>
}

export default ReviewActions
