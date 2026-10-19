import { useEffect, useRef, useState } from 'react'
import { acceptConnectionRequest, apiRequest, clearStoredToken, deleteConnection, getActivity, getAlbumDetails, getPendingConnections, getSentConnections, getStoredToken } from './api.js'
import AppHeader from './AppHeader.jsx'
import RatingVinyls from './RatingVinyls.jsx'
import './ActivityPage.css'

function connectionPerson(connection, incoming) {
  const role = incoming ? 'requester' : 'recipient'
  const userKey = incoming ? 'user1' : 'user2'
  const person = connection.user || connection.profile || connection[role] || connection.sender || connection[userKey] || connection[`${userKey}_profile`] || {}
  // The connection list routes return this user's details as top-level fields.
  const username = connection.username
    || person.username
    || connection[`${role}_username`]
    || connection[`${userKey}_username`]
    || connection[`username${incoming ? '1' : '2'}`]
    || ''
  const id = connection.user_id ?? person.id ?? person.user_id ?? connection[`${role}_id`] ?? connection[userKey === 'user1' ? 'user_id1' : 'user_id2']
  const name = connection.name
    || person.name
    || person.display_name
    || connection[`${role}_name`]
    || connection[`${userKey}_name`]
    || connection[`name${incoming ? '1' : '2'}`]
    || connection.display_name
  return {
    id,
    username: username || (id != null ? `user-${id}` : 'unknown-user'),
    name: name || username || (id != null ? `User ${id}` : 'MayoMix listener'),
    image: connection.pfp_link || person.pfp_link || person.profile_image || person.avatar || connection[`${role}_pfp_link`] || connection[`${userKey}_pfp_link`] || '',
  }
}

function ConnectionCard({ connection, incoming, onAccept, onDelete, busy }) {
  const person = connectionPerson(connection, incoming)
  const connectionId = connection.con_id ?? connection.connection_id ?? connection.id
  return (
    <article className="activity-connection-card">
      <a className="activity-person" href={person.username.startsWith('user-') ? undefined : `/users/${encodeURIComponent(person.username)}`}>
        <img src={person.image || '/images/profile-default.png'} alt="" onError={(event) => { event.currentTarget.src = '/images/profile-default.png' }} />
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
  const owner = review.user || review.reviewer || review.owner || review.author || {}
  const mbid = review.album_mbid || review.mbid || album?.mbid || album?.id || ''
  const username = review.username || review.owner_username || review.reviewer_username || review.user_username || owner.username || review.handle || ''
  const name = review.display_name || review.reviewer_name || review.user_name || owner.name || owner.display_name || review.name || ''
  const authorLabel = name || (username ? `@${username}` : 'MayoMix listener')
  const [authorProfile, setAuthorProfile] = useState(null)
  const date = formatActivityDate(review.create_date || review.created_at || review.review_date || review.date)
  const title = album?.title || review.album_title || review.title || 'Album review'
  const artist = album?.artist || review.artist || review.artist_name || ''
  const image = album?.image || album?.cover_url || review.cover_url || (mbid ? `https://coverartarchive.org/release-group/${encodeURIComponent(mbid)}/front-250` : '')
  const text = review.review_str || review.review_text || review.text || review.review || ''

  useEffect(() => {
    if (!username || (name && owner.pfp_link)) return undefined
    let cancelled = false
    apiRequest(`/users/${encodeURIComponent(username)}`).then((profile) => {
      if (!cancelled) setAuthorProfile(profile)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [name, owner.pfp_link, username])

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
          <img src={owner.pfp_link || owner.profile_image || authorProfile?.pfp_link || review.pfp_link || '/images/profile-default.png'} alt="" onError={(event) => { event.currentTarget.src = '/images/profile-default.png' }} />
          <span><strong>{name || authorProfile?.name || authorLabel}</strong>{username && <small>@{username}</small>}</span>
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
  const [connectionsExpanded, setConnectionsExpanded] = useState(false)
  const [activity, setActivity] = useState([])
  const [pendingError, setPendingError] = useState('')
  const [sentError, setSentError] = useState('')
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
    Promise.allSettled([getPendingConnections(token), getSentConnections(token), getActivity(token)])
      .then(([incomingResult, outgoingResult, feedResult]) => {
        if (cancelled) return
        const results = [incomingResult, outgoingResult, feedResult]
        const authFailure = results.find((result) => result.status === 'rejected'
          && /401|unauthorized|unauthenticated|not authenticated|credentials/i.test(result.reason?.message || ''))
        if (authFailure) {
          clearStoredToken()
          window.location.replace('/login')
          return
        }
        if (incomingResult.status === 'fulfilled') setPending(incomingResult.value)
        else setPendingError(incomingResult.reason?.message || 'Requests could not be loaded.')
        if (outgoingResult.status === 'fulfilled') setSent(outgoingResult.value)
        else setSentError(outgoingResult.reason?.message || 'Sent requests could not be loaded.')
        if (feedResult.status === 'fulfilled') setActivity(feedResult.value)
        else setError(feedResult.reason?.message || 'Activity could not be loaded.')
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

  function returnToActivityTop() {
    if (window.matchMedia('(max-width: 760px)').matches) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="activity-page">
      <AppHeader />
      <div className="activity-workspace">
        <section className={`activity-connections-panel${connectionsExpanded ? ' is-expanded' : ''}`} aria-label="Connections">
          <h1>Connections</h1>
          <button className="activity-connections-toggle" type="button" aria-expanded={connectionsExpanded} onClick={() => setConnectionsExpanded((expanded) => !expanded)}>
            <span>Connections</span>
            {!connectionsExpanded && <><span className="activity-connections-count">({pending.length})</span><span className="activity-connections-chevron" aria-hidden="true" /></>}
          </button>
          <div className={`activity-connections-content${connectionsExpanded ? ' is-expanded' : ''}`}>
          <section className="connection-group incoming-group" aria-label="Incoming requests">
            <h2>Requests</h2>
            <div className="connection-list" aria-busy={loading}>
              {loading && <p className="activity-empty">Loading requests…</p>}
              {!loading && pendingError && <p className="activity-empty is-error" role="alert">{pendingError}</p>}
              {!loading && !pendingError && pending.length === 0 && <p className="activity-empty">No requests</p>}
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
              {!loading && sentError && <p className="activity-empty is-error" role="alert">{sentError}</p>}
              {!loading && !sentError && sent.length === 0 && <p className="activity-empty">No sent requests</p>}
              {sent.map((connection, index) => {
                const id = connection.con_id ?? connection.connection_id ?? connection.id ?? `sent-${index}`
                return <ConnectionCard key={id} connection={connection} incoming={false} onDelete={(connectionId) => updateConnection(connectionId, 'delete')} busy={busyId === id} />
              })}
            </div>
          </section>
          {actionError && <p className="activity-action-error" role="alert">{actionError}</p>}
          </div>
        </section>
        <section className="activity-feed-panel" aria-label="Activity" aria-busy={loading}>
          <h1><button className="activity-tab" type="button" onClick={returnToActivityTop}>Activity</button></h1>
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
