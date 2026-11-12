import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { acceptConnectionRequest, apiRequest, clearStoredToken, deleteConnection, getActivity, getAlbumDetails, getConnections, getPendingConnections, getSentConnections, getStoredToken, normalizeArtworkUrl } from '../../api/api.js'
import AppHeader from '../../components/layout/AppHeader.jsx'
import RatingVinyls from '../../components/ratings/RatingVinyls.jsx'
import MetadataBuffering from '../../components/feedback/MetadataBuffering.jsx'
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

function ConnectionCard({ connection, incoming, section, onAccept, onDelete, busy }) {
  const person = connectionPerson(connection, incoming)
  const connectionId = connection.con_id ?? connection.connection_id ?? connection.id
  return (
    <article className="activity-connection-card">
      <Link className="activity-person" to={person.username.startsWith('user-') ? '/' : `/users/${encodeURIComponent(person.username)}`} onClick={(event) => { if (person.username.startsWith('user-')) event.preventDefault() }}>
        <img src={person.image || '/images/profile-default.png'} alt="" onError={(event) => { event.currentTarget.src = '/images/profile-default.png' }} />
        <span className="activity-person-copy">
          <strong title={person.name}>{person.name}</strong>
          <span title={`@${person.username}`}>@{person.username}</span>
        </span>
      </Link>
      <div className="activity-connection-actions">
        {incoming && <button type="button" aria-label={`Accept ${person.username}'s request`} disabled={busy || connectionId == null} onClick={() => onAccept(connectionId)}><img src="/images/connection-accept.png" alt="" /></button>}
        <button type="button" aria-label={`${section === 'requests' ? 'Decline' : section === 'sent' ? 'Cancel' : 'Disconnect'} ${person.username}${section === 'connected' ? '' : "'s request"}`} disabled={busy || connectionId == null} onClick={() => onDelete(connectionId, person, connection)}><img src="/images/connection-decline.png" alt="" /></button>
      </div>
    </article>
  )
}

function ConnectionConfirmDialog({ confirmation, busy, onCancel, onConfirm }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  if (!confirmation) return null
  const username = confirmation.person.username
  const title = confirmation.section === 'requests'
    ? 'Decline this connection request?'
    : confirmation.section === 'sent'
      ? 'Cancel this connection request?'
      : 'Disconnect from this person?'
  const description = confirmation.section === 'requests'
    ? `Decline @${username}'s request to connect with you?`
    : confirmation.section === 'sent'
      ? `Cancel your request to connect with @${username}?`
      : `Remove @${username} from your connections?`
  const actionLabel = confirmation.section === 'requests' ? 'Decline request' : confirmation.section === 'sent' ? 'Cancel request' : 'Disconnect'
  return <dialog className="connection-confirm-dialog" ref={dialogRef} aria-labelledby="connection-confirm-title" aria-describedby="connection-confirm-description" onCancel={(event) => { event.preventDefault(); onCancel() }}>
    <h2 id="connection-confirm-title">{title}</h2>
    <p id="connection-confirm-description">{description}</p>
    <div className="connection-confirm-actions"><button type="button" onClick={onCancel}>{confirmation.section === 'connected' ? 'Keep connection' : 'Keep request'}</button><button type="button" className="is-danger" disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : actionLabel}</button></div>
  </dialog>
}

function formatActivityDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function getAlbumTitle(mbid, ...values) {
  return values.find((value) => typeof value === 'string'
    && value.trim()
    && value.trim() !== mbid
    && !/^album\s+review$/i.test(value.trim())) || ''
}

function ActivityReviewCard({ review, token }) {
  const initialAlbum = review.album || review.album_info || review.metadata || null
  const mbid = review.album_mbid || review.mbid || initialAlbum?.mbid || initialAlbum?.id || ''
  const hasInitialTitle = Boolean(getAlbumTitle(mbid, initialAlbum?.title, review.album_title, review.title))
  const [album, setAlbum] = useState(initialAlbum)
  const [albumTitleLookup, setAlbumTitleLookup] = useState(hasInitialTitle ? 'complete' : mbid ? 'loading' : 'failed')
  const albumTitleLoading = albumTitleLookup === 'loading'
  const owner = review.user || review.reviewer || review.owner || review.author || {}
  const username = review.username || review.owner_username || review.reviewer_username || review.user_username || owner.username || review.handle || ''
  const name = review.display_name || review.reviewer_name || review.user_name || owner.name || owner.display_name || review.name || ''
  const authorLabel = name || (username ? `@${username}` : 'MayoMix listener')
  const [authorProfile, setAuthorProfile] = useState(null)
  const date = formatActivityDate(review.create_date || review.created_at || review.review_date || review.date)
  const titleValue = getAlbumTitle(mbid, album?.title, review.album_title, review.title)
  const title = titleValue || (albumTitleLoading ? '' : 'Album title')
  const artist = album?.artist || review.artist || review.artist_name || ''
  const image = normalizeArtworkUrl(album?.image || album?.cover_url || review.cover_url || (mbid ? `https://coverartarchive.org/release-group/${encodeURIComponent(mbid)}/front-250` : ''))
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
    if (!mbid || hasInitialTitle) return undefined
    let cancelled = false
    async function loadTitle() {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (cancelled) return
        try {
          const details = await getAlbumDetails(mbid, token)
          const resolvedTitle = getAlbumTitle(mbid, details.title, details.name)
          if (cancelled) return
          if (details && (details.title || details.artist || details.image)) {
            setAlbum((current) => ({ ...current, ...details }))
          }
          if (resolvedTitle) {
            setAlbumTitleLookup('complete')
            return
          }
        } catch {
          if (cancelled) return
        }
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
      }
      if (!cancelled) setAlbumTitleLookup('failed')
    }
    loadTitle()
    return () => { cancelled = true }
  }, [hasInitialTitle, mbid, token])

  return (
    <article className="activity-entry">
      <header className="activity-entry-header">
        <Link className="activity-author" to={username ? `/users/${encodeURIComponent(username)}` : '/'} onClick={(event) => { if (!username) event.preventDefault() }}>
          <img src={owner.pfp_link || owner.profile_image || authorProfile?.pfp_link || review.pfp_link || '/images/profile-default.png'} alt="" onError={(event) => { event.currentTarget.src = '/images/profile-default.png' }} />
          <span><strong>{name || authorProfile?.name || authorLabel}</strong>{username && <small>@{username}</small>}</span>
        </Link>
        <time>{date}</time>
      </header>
      <article className={`activity-review-card${albumTitleLoading ? ' is-buffering' : ''}`} aria-busy={albumTitleLoading}>
        <div className="activity-album-top">
          <div className="activity-album-art">
            {image && <img src={image} alt={`${title || 'Album'} cover`} loading="lazy" onError={(event) => event.currentTarget.remove()} />}
          </div>
          <div className="activity-album-meta">
            <h3 title={title || undefined}>{title}</h3>
            {artist && <p title={artist}>{artist}</p>}
            <RatingVinyls className="activity-rating" rating={review.rating} />
          </div>
        </div>
        <div className="activity-review-divider" />
        <p className="activity-review-text">{text}</p>
        {albumTitleLoading && <div className="activity-review-buffering"><MetadataBuffering label="Loading album details" /></div>}
      </article>
    </article>
  )
}

function ActivityPage() {
  const token = getStoredToken()
  const [pending, setPending] = useState([])
  const [sent, setSent] = useState([])
  const [connections, setConnections] = useState([])
  const [activeConnectionTab, setActiveConnectionTab] = useState('requests')
  const [connectionsExpanded, setConnectionsExpanded] = useState(false)
  const [activity, setActivity] = useState([])
  const [pendingError, setPendingError] = useState('')
  const [sentError, setSentError] = useState('')
  const [connectionsError, setConnectionsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [confirmation, setConfirmation] = useState(null)

  useEffect(() => {
    if (!token) {
      window.location.replace('/login')
      return undefined
    }
    let cancelled = false
    Promise.allSettled([getPendingConnections(token), getSentConnections(token), getConnections(token), getActivity(token)])
      .then(([incomingResult, outgoingResult, connectionsResult, feedResult]) => {
        if (cancelled) return
        const results = [incomingResult, outgoingResult, connectionsResult, feedResult]
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
        if (connectionsResult.status === 'fulfilled') setConnections(connectionsResult.value)
        else setConnectionsError(connectionsResult.reason?.message || 'Connections could not be loaded.')
        if (feedResult.status === 'fulfilled') {
          setActivity(feedResult.value)
        } else setError(feedResult.reason?.message || 'Activity could not be loaded.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  async function updateConnection(connectionId, action, section) {
    setBusyId(connectionId)
    setActionError('')
    try {
      if (action === 'accept') await acceptConnectionRequest(connectionId, token)
      else await deleteConnection(connectionId, token)
      if (action === 'accept') {
        setPending((items) => items.filter((item) => (item.con_id ?? item.connection_id ?? item.id) !== connectionId))
        try {
          setConnections(await getConnections(token))
          setConnectionsError('')
        } catch (refreshError) {
          setConnectionsError(refreshError.message || 'Connections could not be refreshed.')
        }
      } else if (section === 'requests') setPending((items) => items.filter((item) => (item.con_id ?? item.connection_id ?? item.id) !== connectionId))
      else if (section === 'sent') setSent((items) => items.filter((item) => (item.con_id ?? item.connection_id ?? item.id) !== connectionId))
      else setConnections((items) => items.filter((item) => (item.con_id ?? item.connection_id ?? item.id) !== connectionId))
    } catch (requestError) {
      setActionError(requestError.message || 'The connection request could not be updated.')
    } finally {
      setBusyId(null)
    }
  }

  function requestConnectionRemoval(connectionId, section, person, connection) {
    setConfirmation({ connectionId, section, person, connection })
  }

  async function confirmConnectionRemoval() {
    if (!confirmation) return
    const { connectionId, section } = confirmation
    await updateConnection(connectionId, 'delete', section)
    setConfirmation(null)
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
          <button className="activity-connections-toggle" type="button" aria-expanded={connectionsExpanded} aria-controls="mobile-connections-content" onClick={() => setConnectionsExpanded((expanded) => !expanded)}>
            <span>Connections</span>
            {!connectionsExpanded && <span className="activity-connections-count">({pending.length})</span>}
            <span className="activity-connections-chevron" aria-hidden="true" />
          </button>
          <div id="mobile-connections-content" className={`activity-connections-content${connectionsExpanded ? ' is-expanded' : ''}`}>
            <div className="connection-tabs" role="group" aria-label="Connection lists">
              {[['requests', 'Requests'], ['sent', 'Sent'], ['connected', 'Connected']].map(([tab, label]) => <button key={tab} id={`connection-tab-${tab}`} className={activeConnectionTab === tab ? 'is-active' : ''} type="button" aria-pressed={activeConnectionTab === tab} aria-controls="connection-tab-panel" onClick={() => setActiveConnectionTab(tab)}>{label}</button>)}
            </div>
            <section className="connection-group" id="connection-tab-panel" role="tabpanel" aria-labelledby={`connection-tab-${activeConnectionTab}`} aria-label={`${activeConnectionTab} connections`}>
              <div className="connection-list" aria-busy={loading}>
                {loading && <p className="activity-empty">Loading {activeConnectionTab === 'requests' ? 'requests' : activeConnectionTab === 'sent' ? 'sent requests' : 'connections'}…</p>}
                {!loading && activeConnectionTab === 'requests' && pendingError && <p className="activity-empty is-error" role="alert">{pendingError}</p>}
                {!loading && activeConnectionTab === 'sent' && sentError && <p className="activity-empty is-error" role="alert">{sentError}</p>}
                {!loading && activeConnectionTab === 'connected' && connectionsError && <p className="activity-empty is-error" role="alert">{connectionsError}</p>}
                {!loading && activeConnectionTab === 'requests' && !pendingError && pending.length === 0 && <p className="activity-empty">No requests</p>}
                {!loading && activeConnectionTab === 'sent' && !sentError && sent.length === 0 && <p className="activity-empty">No sent requests</p>}
                {!loading && activeConnectionTab === 'connected' && !connectionsError && connections.length === 0 && <p className="activity-empty">No connections yet</p>}
                {!loading && activeConnectionTab === 'requests' && pending.map((connection, index) => {
                  const id = connection.con_id ?? connection.connection_id ?? connection.id ?? `pending-${index}`
                  return <ConnectionCard key={id} connection={connection} incoming section="requests" onAccept={(connectionId) => updateConnection(connectionId, 'accept', 'requests')} onDelete={(connectionId, person, item) => requestConnectionRemoval(connectionId, 'requests', person, item)} busy={busyId === id} />
                })}
                {!loading && activeConnectionTab === 'sent' && sent.map((connection, index) => {
                  const id = connection.con_id ?? connection.connection_id ?? connection.id ?? `sent-${index}`
                  return <ConnectionCard key={id} connection={connection} incoming={false} section="sent" onDelete={(connectionId, person, item) => requestConnectionRemoval(connectionId, 'sent', person, item)} busy={busyId === id} />
                })}
                {!loading && activeConnectionTab === 'connected' && connections.map((connection, index) => {
                  const id = connection.con_id ?? connection.connection_id ?? connection.id ?? `connected-${index}`
                  return <ConnectionCard key={id} connection={connection} incoming={false} section="connected" onDelete={(connectionId, person, item) => requestConnectionRemoval(connectionId, 'connected', person, item)} busy={busyId === id} />
                })}
              </div>
            </section>
            {actionError && <p className="activity-action-error" role="alert">{actionError}</p>}
          </div>
        </section>
        <section className="activity-feed-panel" aria-label="Activity" aria-busy={loading}>
          <h1><button className="activity-tab" type="button" onClick={returnToActivityTop}>Activity</button></h1>
          <div className="activity-feed">
            {loading && <div className="activity-metadata-loading"><MetadataBuffering label="Loading activity" /></div>}
            {error && !loading && <p className="activity-empty is-error" role="alert">{error}</p>}
            {!loading && !error && activity.length === 0 && <p className="activity-empty">Your connections’ reviews will appear here.</p>}
            {!loading && !error && activity.map((review, index) => <ActivityReviewCard key={review.id || review.review_id || `${review.mbid}-${index}`} review={review} token={token} />)}
          </div>
        </section>
      </div>
      {confirmation && <ConnectionConfirmDialog confirmation={confirmation} busy={busyId === confirmation.connectionId} onCancel={() => setConfirmation(null)} onConfirm={confirmConnectionRemoval} />}
    </main>
  )
}

export default ActivityPage
