import { useEffect, useRef, useState } from 'react'
import { acceptConnectionRequest, clearStoredToken, deleteConnection, getActivity, getAlbumDetails, getPendingConnections, getSentConnections, getStoredToken } from './api.js'
import AppHeader from './AppHeader.jsx'
import RatingVinyls from './RatingVinyls.jsx'
import './ActivityPage.css'

function connectionPerson(connection, incoming) {
  const person = connection.user || connection.profile || connection.requester || connection.sender || connection.recipient || connection[incoming ? 'user1' : 'user2'] || {}
  const username = person.username || connection.username || connection.requester_username || connection.sender_username || connection.recipient_username || ''
  const id = person.id ?? person.user_id ?? (incoming ? connection.user_id1 : connection.user_id2) ?? connection.user_id
  return {
    id,
    username: username || (id != null ? `user-${id}` : 'unknown-user'),
    name: person.name || person.display_name || connection.name || connection.display_name || username || (id != null ? `User ${id}` : 'MayoMix listener'),
    image: person.pfp_link || person.profile_image || person.avatar || connection.pfp_link || '',
  }
}

function ConnectionCard({ connection, incoming, onAccept, onDelete, busy }) {
  const person = connectionPerson(connection, incoming)
  const connectionId = connection.con_id ?? connection.connection_id ?? connection.id
  return (
    <article className="activity-connection-card">
      <a className="activity-person" href={person.username.startsWith('user-') ? undefined : `/users/${encodeURIComponent(person.username)}`}>
        <img src={person.image || '/images/profile-vinyl.png'} alt="" onError={(event) => { event.currentTarget.src = '/images/profile-vinyl.png' }} />
        <span className="activity-person-copy">
          <strong title={person.name}>{person.name}</strong>
          <span title={`@${person.username}`}>@{person.username}</span>
        </span>
      </a>
      <div className="activity-connection-actions">
        {incoming && <button type="button" aria-label={`Accept ${person.username}'s request`} disabled={busy || connectionId == null} onClick={() => onAccept(connectionId)}><img src="/images/connection-accept.png" alt="" /></button>}
        <button type="button" aria-label={`${incoming ? 'Decline' : 'Cancel'} ${person.username}'s request`} disabled={busy || connectionId == null} onClick={() => onDelete(connectionId)}><img src="/images/connection-decline.png" alt="" /></button>
      </div>
    </article>
  )
}

function formatActivityDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function ActivityReviewCard({ review, token }) {
  const cardRef = useRef(null)
  const [album, setAlbum] = useState(review.album || review.album_info || null)
  const mbid = review.album_mbid || review.mbid || album?.mbid || album?.id || ''
  const username = review.username || review.user?.username || review.reviewer?.username || review.handle || ''
  const name = review.user?.name || review.reviewer?.name || review.name || username || 'MayoMix listener'
  const date = formatActivityDate(review.create_date || review.created_at || review.review_date || review.date)
  const title = album?.title || review.album_title || review.title || 'Album review'
  const artist = album?.artist || review.artist || review.artist_name || ''
  const image = album?.image || album?.cover_url || review.cover_url || (mbid ? `https://coverartarchive.org/release-group/${encodeURIComponent(mbid)}/front-250` : '')
  const text = review.review_str || review.review_text || review.text || review.review || ''

  useEffect(() => {
    if (!mbid || album?.title) return undefined
    let cancelled = false
    const load = () => getAlbumDetails(mbid, token).then((details) => {
      if (!cancelled && details.title && details.title !== mbid) setAlbum(details)
    }).catch(() => {})
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
    }, { rootMargin: '160px' })
    observer.observe(node)
    return () => { cancelled = true; observer.disconnect() }
  }, [album?.title, mbid, token])

  return (
    <article className="activity-entry" ref={cardRef}>
      <header className="activity-entry-header">
        <a className="activity-author" href={username ? `/users/${encodeURIComponent(username)}` : undefined}>
          <img src={review.user?.pfp_link || review.reviewer?.pfp_link || review.pfp_link || '/images/profile-vinyl.png'} alt="" onError={(event) => { event.currentTarget.src = '/images/profile-vinyl.png' }} />
          <span><strong>{name}</strong>{username && <small>@{username}</small>}</span>
        </a>
        <time>{date}</time>
      </header>
      <article className="activity-review-card">
        <div className="activity-album-top">
          <div className="activity-album-art">
            {image && <img src={image} alt={`${title} cover`} loading="lazy" onError={(event) => event.currentTarget.remove()} />}
          </div>
          <div className="activity-album-meta">
            <h3 title={title}>{title}</h3>
            {artist && <p title={artist}>{artist}</p>}
            <RatingVinyls className="activity-rating" rating={review.rating} />
          </div>
        </div>
        <div className="activity-review-divider" />
        <p className="activity-review-text">{text}</p>
      </article>
    </article>
  )
}

function ActivityPage() {
  const token = getStoredToken()
  const [pending, setPending] = useState([])
  const [sent, setSent] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    if (!token) {
      window.location.replace('/login')
      return undefined
    }
    let cancelled = false
    Promise.all([getPendingConnections(token), getSentConnections(token), getActivity(token)])
      .then(([incoming, outgoing, feed]) => {
        if (cancelled) return
        setPending(incoming)
        setSent(outgoing)
        setActivity(feed)
      })
      .catch((requestError) => {
        if (cancelled) return
        if (/401|unauthorized|unauthenticated|not authenticated|credentials/i.test(requestError.message)) {
          clearStoredToken()
          window.location.replace('/login')
        } else setError(requestError.message || 'Activity could not be loaded.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  async function updateConnection(connectionId, action) {
    setBusyId(connectionId)
    setActionError('')
    try {
      if (action === 'accept') await acceptConnectionRequest(connectionId, token)
      else await deleteConnection(connectionId, token)
      setPending((items) => items.filter((item) => (item.con_id ?? item.connection_id ?? item.id) !== connectionId))
      setSent((items) => items.filter((item) => (item.con_id ?? item.connection_id ?? item.id) !== connectionId))
    } catch (requestError) {
      setActionError(requestError.message || 'The connection request could not be updated.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="activity-page">
      <AppHeader />
      <div className="activity-workspace">
        <section className="activity-connections-panel" aria-label="Connections">
          <h1>Connections</h1>
          <section className="connection-group" aria-label="Incoming requests">
            <h2>Requests</h2>
            <div className="connection-list" aria-busy={loading}>
              {loading && <p className="activity-empty">Loading requests…</p>}
              {!loading && pending.length === 0 && <p className="activity-empty">No requests</p>}
              {pending.map((connection, index) => {
                const id = connection.con_id ?? connection.connection_id ?? connection.id ?? `pending-${index}`
                return <ConnectionCard key={id} connection={connection} incoming onAccept={(connectionId) => updateConnection(connectionId, 'accept')} onDelete={(connectionId) => updateConnection(connectionId, 'delete')} busy={busyId === id} />
              })}
            </div>
          </section>
          <section className="connection-group sent-group" aria-label="Sent requests">
            <h2>Sent</h2>
            <div className="connection-list" aria-busy={loading}>
              {loading && <p className="activity-empty">Loading requests…</p>}
              {!loading && sent.length === 0 && <p className="activity-empty">No sent requests</p>}
              {sent.map((connection, index) => {
                const id = connection.con_id ?? connection.connection_id ?? connection.id ?? `sent-${index}`
                return <ConnectionCard key={id} connection={connection} incoming={false} onDelete={(connectionId) => updateConnection(connectionId, 'delete')} busy={busyId === id} />
              })}
            </div>
          </section>
          {actionError && <p className="activity-action-error" role="alert">{actionError}</p>}
        </section>
        <section className="activity-feed-panel" aria-label="Activity" aria-busy={loading}>
          <h1>Activity</h1>
          <div className="activity-feed">
            {loading && <p className="activity-empty">Loading activity…</p>}
            {error && !loading && <p className="activity-empty is-error" role="alert">{error}</p>}
            {!loading && !error && activity.length === 0 && <p className="activity-empty">Your connections’ reviews will appear here.</p>}
            {activity.map((review, index) => <ActivityReviewCard key={review.id || review.review_id || `${review.mbid}-${index}`} review={review} token={token} />)}
          </div>
        </section>
      </div>
    </main>
  )
}

export default ActivityPage
