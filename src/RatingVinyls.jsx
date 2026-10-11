import { itemDetails } from './api.js'
import './RatingVinyls.css'

function RatingVinyls({ rating, item, size = 'medium', className = '' }) {
  const details = item ? itemDetails(item) : {}
  const value = Number(rating ?? details.rating ?? details.score ?? details.value ?? details.rating_value)
  if (!Number.isFinite(value)) return null
  const score = Math.max(0, Math.min(10, value))

  return <div className={`rating-vinyls rating-vinyls-${size} ${className}`.trim()} role="img" aria-label={`Rated ${score} out of 10`}>
    {Array.from({ length: 5 }, (_, index) => {
      const state = score >= (index + 1) * 2 ? 'full' : score === index * 2 + 1 ? 'half' : 'empty'
      return <span className={`vinyl-rating is-${state}`} key={index}>
        <img className="vinyl-rating-base" src="/images/vinyl.png" alt="" />
        {state === 'full' && <img className="vinyl-rating-full" src="/images/vinyl.png" alt="" />}
        {state === 'half' && <img className="vinyl-rating-half" src="/images/vinyl-half.png" alt="" />}
      </span>
    })}
  </div>
}

export default RatingVinyls
