import { useState } from 'react'
import './VinylRatingPicker.css'

const DISC_COUNT = 5
const MAX_RATING = DISC_COUNT * 2

function clampRating(value) {
  return Math.max(0, Math.min(MAX_RATING, Number(value) || 0))
}

function discState(rating, disc) {
  const fullValue = disc * 2
  if (rating >= fullValue) return 'full'
  if (rating === fullValue - 1) return 'half'
  return 'empty'
}

function VinylRatingPicker({ value = 0, onChange, disabled = false, className = '', label = 'Album rating' }) {
  const [previewRating, setPreviewRating] = useState(null)
  const selectedRating = clampRating(value)
  const displayRating = previewRating == null ? selectedRating : previewRating

  return <div
    className={`vinyl-rating-picker ${className}`.trim()}
    role="group"
    aria-label={`${label}: ${selectedRating || 'not set'} out of ${MAX_RATING}`}
    onPointerLeave={() => setPreviewRating(null)}
  >
    {Array.from({ length: DISC_COUNT }, (_, index) => {
      const disc = index + 1
      const state = discState(displayRating, disc)
      return <span className={`vinyl-rating-picker-disc is-${state}`} key={disc}>
        <img className="vinyl-rating-picker-base" src="/images/vinyl.png" alt="" />
        {state === 'full' && <img className="vinyl-rating-picker-fill" src="/images/vinyl.png" alt="" />}
        {state === 'half' && <img className="vinyl-rating-picker-fill is-half" src="/images/vinyl-half.png" alt="" />}
        {[disc * 2 - 1, disc * 2].map((rating, half) => {
          const isCurrent = rating === selectedRating
          return <button
            key={rating}
            className={`vinyl-rating-picker-button ${half === 0 ? 'is-left' : 'is-right'}`}
            type="button"
            aria-label={isCurrent ? `Clear rating of ${rating} out of ${MAX_RATING}` : `Set rating to ${rating} out of ${MAX_RATING}`}
            aria-pressed={isCurrent}
            disabled={disabled}
            onPointerEnter={() => setPreviewRating(rating)}
            onFocus={() => setPreviewRating(rating)}
            onBlur={() => setPreviewRating(null)}
            onClick={() => {
              if (disabled) return
              setPreviewRating(null)
              onChange?.(isCurrent ? 0 : rating)
            }}
          />
        })}
      </span>
    })}
  </div>
}

export default VinylRatingPicker
