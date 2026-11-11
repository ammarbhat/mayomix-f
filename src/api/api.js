import { queryClient, clearPrivateQueriesExcept } from '../app/queryClient.js'
import { describeApiQuery, getTokenScope, queryKeys, QUERY_FRESHNESS } from '../app/queryKeys.js'
import { getMusicBrainzCacheItem, saveMusicBrainzCacheItem } from './musicBrainzCache.js'
import { clearProfileSnapshot } from '../pages/profile/profileSnapshotCache.js'

export const API_ROOT = (import.meta.env?.VITE_API_BASE_URL || (
  import.meta.env?.DEV ? '/api' : 'https://mayomix.onrender.com'
)).replace(/\/$/, '')
const TOKEN_KEY = 'mayomix.access_token'
const TOKEN_TYPE_KEY = 'mayomix.token_type'
const USE_LOCAL_ARTWORK_PROXY = Boolean(import.meta.env?.DEV || (
  typeof window !== 'undefined'
  && window.location.protocol === 'http:'
  && !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
))

async function performApiRequest(path, token, options) {
  const headers = new Headers(options.headers || {})
  if (token) {
    const tokenType = sessionStorage.getItem(TOKEN_TYPE_KEY) || 'Bearer'
    headers.set('Authorization', `${tokenType} ${token}`)
  }

  const response = await fetch(`${API_ROOT}${path}`, { ...options, headers })
  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.detail
      ? (Array.isArray(payload.detail) ? payload.detail.map((item) => item.msg).join(', ') : payload.detail)
      : `Request failed (${response.status})`
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return payload
}

function queryKeysForMutation(path, token, body, context = {}) {
  const scope = getTokenScope(token)
  if (!scope) return []
  const url = new URL(path, 'http://mayomix.local')
  const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
  const keys = []

  if (parts[0] === 'users' && parts[1] === 'me' && parts[2] === 'reviews' && parts.length === 3) {
    const mbid = body?.mbid
    if (mbid) keys.push(queryKeys.albumReviews(mbid))
    keys.push(queryKeys.user(scope).concat('reviews'))
    keys.push(queryKeys.privateActivity(scope))
  } else if (parts[0] === 'users' && parts[1] === 'me' && parts[2] === 'reviews' && parts.length === 4) {
    const mbid = context.albumMbid
    if (mbid) keys.push(queryKeys.albumReviews(mbid))
    else {
      queryClient.getQueryCache().findAll({ predicate: (query) => query.queryKey[0] === 'album' && query.queryKey[2] === 'reviews' })
        .forEach((query) => keys.push(query.queryKey))
    }
    keys.push(queryKeys.user(scope).concat('reviews'))
    keys.push(queryKeys.privateActivity(scope))
  } else if (parts[0] === 'users' && parts[1] === 'me' && parts[2] === 'taste' && parts.length === 3) {
    const category = url.searchParams.get('category')
    keys.push(category ? queryKeys.user(scope).concat('taste', category) : queryKeys.user(scope).concat('taste'))
    keys.push(queryKeys.privateLikedTaste(scope))
  } else if (parts[0] === 'users' && parts[1] === 'me' && parts[2] === 'taste' && parts.length === 4) {
    keys.push(queryKeys.user(scope).concat('taste'))
    keys.push(queryKeys.privateLikedTaste(scope))
  } else if (parts[0] === 'users' && parts[1] === 'me' && parts.length === 2) {
    keys.push(queryKeys.privateAccount(scope).concat('me'))
    keys.push(queryKeys.user(scope).concat('profile'))
    keys.push(['search', 'users'])
    if (typeof body?.username === 'string' && body.username !== scope) {
      keys.push(queryKeys.user(body.username).concat('profile'))
    }
  } else if (parts[0] === 'connections' && parts[1] === 'me' && parts[2] === 'status') {
    keys.push(['private', scope, 'connectionStatus', parts[3] || ''])
  } else if (parts[0] === 'connections' && parts.length === 3 && parts[2] === 'accept') {
    keys.push(queryKeys.privateConnections(scope), queryKeys.privateConnectionStatuses(scope), queryKeys.privateActivity(scope))
  } else if (parts[0] === 'connections' && parts.length === 2) {
    keys.push(queryKeys.privateConnections(scope), queryKeys.privateConnectionStatuses(scope))
    if (context.connectionUsername) keys.push(['private', scope, 'connectionStatus', context.connectionUsername])
    if (parts[1] === 'accept' || isAcceptedConnection(parts[1], scope)) keys.push(queryKeys.privateActivity(scope))
  } else if (parts[0] === 'users' && parts.length === 2 && parts[1] !== 'me') {
    keys.push(queryKeys.privateAccount(scope))
    keys.push(queryKeys.user(parts[1]))
  }

  return keys
}

function isAcceptedConnection(connectionId, scope) {
  const query = queryClient.getQueryCache().find({
    queryKey: ['private', scope, 'connections', 'accepted'],
    exact: true,
  })
  const payload = query?.state.data
  const entries = Array.isArray(payload) ? payload : Object.values(payload || {}).find(Array.isArray) || []
  return entries.some((entry) => String(entry.con_id ?? entry.connection_id ?? entry.id) === String(connectionId) && entry.accepted)
}

async function invalidateMutationResources(path, token, body, context) {
  const keys = queryKeysForMutation(path, token, body, context)
  for (const queryKey of keys) await queryClient.cancelQueries({ queryKey })
  for (const queryKey of keys) await queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
}

export function apiRequest(path, { token, cache = true, invalidationContext, ...options } = {}) {
  const method = (options.method || 'GET').toUpperCase()
  if (method !== 'GET') {
    return performApiRequest(path, token, options).then(async (value) => {
      let body = null
      try { body = JSON.parse(options.body) } catch { /* Requests without JSON bodies need no parsed context. */ }
      const pathname = new URL(path, 'http://mayomix.local').pathname
      if (pathname === '/users/me' || pathname.startsWith('/users/me/taste')) {
        clearProfileSnapshot(getTokenScope(token))
        if (typeof body?.username === 'string') clearProfileSnapshot(body.username)
      }
      if (method === 'DELETE' && /^\/users\/[^/]+$/.test(pathname)) {
        clearProfileSnapshot(decodeURIComponent(pathname.split('/')[2]))
      }
      await invalidateMutationResources(path, token, body, invalidationContext)
      return value
    })
  }
  if (!cache) return performApiRequest(path, token, options)
  const query = describeApiQuery(path, token)
  if (query.queryKey[0] === 'private' && !getTokenScope(token)) return performApiRequest(path, token, options)
  return queryClient.fetchQuery({
    queryKey: query.queryKey,
    queryFn: async ({ signal }) => {
      try {
        return await performApiRequest(path, token, { ...options, signal })
      } catch (error) {
        if (query.emptyOnNotFound && error.status === 404) return []
        throw error
      }
    },
    staleTime: query.staleTime,
    gcTime: query.gcTime,
  })
}

export async function signIn(username, password) {
  const body = new URLSearchParams({ username, password })
  const tokenData = await apiRequest('/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!tokenData?.access_token) throw new Error('The API did not return an access token.')
  clearPrivateQueriesExcept()
  sessionStorage.setItem(TOKEN_KEY, tokenData.access_token)
  sessionStorage.setItem(TOKEN_TYPE_KEY, tokenData.token_type || 'Bearer')
}

export async function signUp(user, password) {
  return apiRequest('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, pwd: { password } }),
  })
}

export function changePassword(password, newPassword, token) {
  return apiRequest('/users/me/password', {
    method: 'PATCH',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, new_password: newPassword }),
  })
}

export function changeUsername(username, token) {
  return apiRequest('/users/me', {
    method: 'PATCH',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })
}

export function getAppDocument(documentName) {
  const paths = {
    developer: '/docs/developer-note',
    privacy: '/docs/privacy-policy',
    terms: '/docs/terms-of-service',
  }
  const path = paths[documentName]
  if (!path) return Promise.reject(new Error('Unknown document.'))
  return apiRequest(path)
}

export function getStoredToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function clearStoredToken() {
  clearProfileSnapshot(getTokenScope(getStoredToken()))
  clearPrivateQueriesExcept()
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_TYPE_KEY)
}

function listFromPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  for (const key of ['items', 'results', 'entries', 'data', 'taste', 'users', 'reviews', 'songs', 'artists', 'liked_songs', 'liked', 'recordings', 'release-groups']) {
    if (Array.isArray(payload[key])) return payload[key]
  }
  if (payload.mbid || payload.title || payload.name || payload.id) return [payload]
  return Object.values(payload).filter((value) => value && typeof value === 'object')
}

export function normalizeArtworkUrl(url, size = 250) {
  if (typeof url !== 'string' || !url) return ''
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'coverartarchive.org') {
      parsed.pathname = parsed.pathname.replace(/\/front(?:-\d+)?\/?$/, `/front-${size}`)
      if (USE_LOCAL_ARTWORK_PROXY) return `/artwork${parsed.pathname}${parsed.search}`
      return parsed.toString()
    }
  } catch {
    return url
  }
  return url
}

export function itemDetails(entry) {
  if (!entry || typeof entry !== 'object') return { title: String(entry ?? '') }
  const nested = entry.album || entry.song || entry.artist || entry.genre || entry.item || entry.recording || entry.meta || entry
  const item = nested && typeof nested === 'object' ? nested : entry
  const image = item.image || item.image_url || item.cover_url || item.cover_art_url || item.artwork_url || item.thumbnail || entry.image || entry.image_url || entry.cover_url || entry.artwork_url || entry.thumbnail || ''
  return {
    ...entry,
    ...item,
    title: item.title || item.name || item.album_title || item.song_title || entry.title || entry.name || entry.label || entry.mbid || '',
    image: normalizeArtworkUrl(image),
  }
}

function cachedItem(key) {
  return getMusicBrainzCacheItem(key)
}

function getMusicBrainzMetadata(kind, mbid, token) {
  return queryClient.fetchQuery({
    queryKey: ['musicbrainz', 'metadata', kind, mbid],
    queryFn: async () => {
      if (kind === 'release-group') {
        const payload = await apiRequest(`/albums/${encodeURIComponent(mbid)}`, { token })
        return { ...itemDetails(payload), mbid }
      }

      const category = kind === 'recording' ? 'songs' : 'artists'
      const query = new URLSearchParams({ query: mbid, limit: '1' })
      const payload = await apiRequest(`/search/${category}?${query}`, { token })
      const candidates = listFromPayload(payload).map((entry) => {
        const item = itemDetails(entry)
        return { ...item, mbid: item.mbid || item.id || item.recording?.id || item.artist?.id || '' }
      })
      const match = candidates.find((entry) => entry.mbid === mbid) || candidates[0]
      if (!match) throw new Error(`No ${category} metadata found for ${mbid}`)
      return match
    },
    staleTime: QUERY_FRESHNESS.albumMetadata,
  })
}

async function enrichMusicItem(item, kind, token) {
  if (!item.mbid) return { ...item, metadataLoading: false, metadataLoaded: true }
  const key = `${kind}:${item.mbid}`
  const cached = cachedItem(key)
  if (cached) return {
    ...cached,
    ...item,
    title: cached.title || item.title,
    artist: item.artist || cached.artist,
    image: normalizeArtworkUrl(item.image || cached.image),
    mbid: item.mbid,
    metadataLoading: false,
    metadataLoaded: true,
  }
  try {
    const metadata = await getMusicBrainzMetadata(kind, item.mbid, token)
    const enriched = { ...item, ...metadata, id: item.id, rank: item.rank, liked: item.liked, mbid: item.mbid, metadataLoading: false, metadataLoaded: true }
    saveMusicBrainzCacheItem(key, enriched)
    return enriched
  } catch {
    return { ...item, metadataLoading: false, metadataLoaded: true }
  }
}

export async function getTasteList(username, category, token, onEnriched) {
  const query = new URLSearchParams({ category })
  const payload = await apiRequest(`/users/${encodeURIComponent(username)}/taste?${query}`, { token })
  const items = listFromPayload(payload).map((entry) => {
    const item = itemDetails(entry)
    return {
      ...item,
      id: entry.id ?? entry.entry_id ?? item.id,
      mbid: item.mbid || entry.mbid || entry.album_mbid || entry.song_mbid || entry.recording_mbid || entry.album?.mbid || entry.song?.mbid || entry.recording?.mbid,
      rank: entry.rank ?? item.rank,
      liked: entry.liked ?? item.liked,
      metadataLoading: Boolean(item.mbid && onEnriched),
      metadataLoaded: !item.mbid || !onEnriched,
    }
  })
  const kind = category === 'top_albums' || category === 'rotation_album'
    ? 'release-group'
    : category === 'rotation_song'
      ? 'recording'
      : category === 'top_artists'
        ? 'artist'
        : null

  if (kind && onEnriched) {
    const enrichedItems = [...items]
    items.forEach((item, index) => {
      let settled = false
      const publish = (value) => {
        enrichedItems[index] = value
        try { onEnriched([...enrichedItems]) } catch { /* Rendering updates must not interrupt other lookups. */ }
      }
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        publish({ ...item, metadataLoading: false, metadataLoaded: true })
      }, 10000)
      enrichMusicItem(item, kind, token).then((enriched) => {
        clearTimeout(timeout)
        settled = true
        publish(enriched)
      }).catch(() => {
        clearTimeout(timeout)
        settled = true
        publish({ ...item, metadataLoading: false, metadataLoaded: true })
      })
    })
  }
  return items
}

export async function getMyTasteList(username, category, token, onEnriched) {
  try {
    return await getTasteList(username, category, token, onEnriched)
  } catch (error) {
    if (error.status === 404 || /404|not found/i.test(error.message)) return []
    throw error
  }
}

export function addTasteItem(category, item, rank, token) {
  const query = new URLSearchParams({ category })
  return apiRequest(`/users/me/taste?${query}`, {
    method: 'POST', token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mbid: item.mbid, rank, liked: Boolean(item.liked) }),
  })
}

export function updateTasteItem(entryId, changes, token) {
  return apiRequest(`/users/me/taste/${encodeURIComponent(entryId)}`, {
    method: 'PATCH', token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
}

export function removeTasteItem(entryId, token) {
  return apiRequest(`/users/me/taste/${encodeURIComponent(entryId)}`, { method: 'DELETE', token })
}

export async function getLikedSongs(token, onEnriched) {
  const payload = await apiRequest('/users/me/taste/liked', { token })
  const items = listFromPayload(payload).map((entry) => {
    const item = itemDetails(entry)
    return { ...item, mbid: item.mbid || item.song_mbid || item.recording_mbid || entry?.song?.mbid || entry?.recording?.mbid || '' }
  }).slice(0, 12)
  if (onEnriched) {
    Promise.all(items.map((item) => enrichMusicItem(item, 'recording', token)))
      .then(onEnriched)
      .catch(() => {})
  }
  return items
}

export async function getUserReviews(username, token, limit = 29, offset = 0) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  const payload = await apiRequest(`/users/${encodeURIComponent(username)}/reviews?${query}`, { token })
  return listFromPayload(payload)
}

export async function getAlbumReviews(mbid, token) {
  const query = new URLSearchParams({ limit: '29', offset: '0' })
  try {
    const payload = await apiRequest(`/albums/${encodeURIComponent(mbid)}/reviews?${query}`, { token })
    return listFromPayload(payload)
  } catch (error) {
    if (/404|not found/i.test(error.message)) return []
    throw error
  }
}

export async function createAlbumReview(mbid, reviewStr, rating, token) {
  return apiRequest('/users/me/reviews', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mbid, review_str: reviewStr, rating }),
  })
}

export async function getConnectionStatus(username, token) {
  const payload = await apiRequest(`/connections/me/status/${encodeURIComponent(username)}`, { token })
  return typeof payload === 'string' ? payload : payload?.status || ''
}

export async function getActivity(token) {
  const query = new URLSearchParams({ limit: '29', offset: '0' })
  try {
    return listFromPayload(await apiRequest(`/activity?${query}`, { token }))
  } catch (error) {
    if (/404|not found/i.test(error.message)) return []
    throw error
  }
}

async function getConnectionList(path, token) {
  try {
    return listFromPayload(await apiRequest(path, { token }))
  } catch (error) {
    if (/404|not found/i.test(error.message)) return []
    throw error
  }
}

export function getPendingConnections(token) {
  return getConnectionList('/connections/me/pending', token)
}

export function getSentConnections(token) {
  return getConnectionList('/connections/me/sent', token)
}

export function getConnections(token) {
  return getConnectionList('/connections/me', token)
}

export function acceptConnectionRequest(connectionId, token) {
  return apiRequest(`/connections/${encodeURIComponent(connectionId)}/accept`, { method: 'PATCH', token })
}

export function deleteConnection(connectionId, token) {
  return apiRequest(`/connections/${encodeURIComponent(connectionId)}`, { method: 'DELETE', token })
}

export async function sendConnectionRequest(token, userId, username) {
  if (userId === undefined || userId === null) {
    throw new Error('The public profile response does not include a user ID, so a connection request cannot be sent yet.')
  }
  return apiRequest(`/connections/${encodeURIComponent(userId)}`, {
    method: 'POST', token, invalidationContext: { connectionUsername: username },
  })
}

export function getAlbumDetails(mbid, token, { forceRefresh = false } = {}) {
  const cacheKey = `release-group:${mbid}`
  const cached = forceRefresh ? null : getMusicBrainzCacheItem(cacheKey)
  const cachedTitle = typeof cached?.title === 'string' ? cached.title.trim() : ''
  if (cachedTitle && cachedTitle !== mbid && !/^album\s+review$/i.test(cachedTitle)) {
    return Promise.resolve({ ...itemDetails(cached), mbid })
  }

  return queryClient.fetchQuery({
    queryKey: ['album', mbid, 'metadata'],
    staleTime: forceRefresh ? 0 : QUERY_FRESHNESS.albumMetadata,
    queryFn: async ({ signal }) => {
      const payload = await performApiRequest(`/albums/${encodeURIComponent(mbid)}`, token, { signal })
      const details = { ...itemDetails(payload), mbid }
      const title = typeof details.title === 'string' ? details.title.trim() : ''
      if (title && title !== mbid && !/^album\s+review$/i.test(title)) {
        saveMusicBrainzCacheItem(cacheKey, details)
      }
      return details
    },
  })
}

export async function cacheProfileArtwork(username, imageUrls) {
  if (!username || !Array.isArray(imageUrls) || !('serviceWorker' in navigator)) return
  const urls = [...new Set(imageUrls
    .map((url) => normalizeArtworkUrl(url))
    .filter((url) => {
      try { return new URL(url).hostname === 'coverartarchive.org' } catch { return false }
    }))]
  if (!urls.length) return

  try {
    const registration = await navigator.serviceWorker.ready
    const worker = navigator.serviceWorker.controller || registration.active
    worker?.postMessage({ type: 'CACHE_PROFILE_ARTWORK', username, urls })
  } catch {
    // Profile rendering remains available if persistent image caching is unavailable.
  }
}

export async function getAlbumTracklist(mbid, album) {
  return queryClient.fetchQuery({
    queryKey: ['album', mbid, 'tracklist'],
    staleTime: QUERY_FRESHNESS.albumMetadata,
    queryFn: async () => {
      const releases = album?.releases || album?.meta?.releases || []
      const releaseId = releases.find((release) => release.id)?.id
      if (!releaseId) return []

      const payload = await apiRequest(`/albums/${encodeURIComponent(releaseId)}/tracklist`)
      return Array.isArray(payload) ? payload : []
    },
  })
}

export async function searchUsers(username) {
  const query = new URLSearchParams({ username })
  const payload = await apiRequest(`/users/search?${query}`)
  return listFromPayload(payload).map(normalizeUserResponse)
}

export function normalizeUserResponse(user) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) return user
  return { ...user, id: user.id ?? user.user_id }
}

export async function searchAlbums(queryText, token, limit = 15) {
  const query = new URLSearchParams({ query: queryText, limit: String(limit) })
  const payload = await apiRequest(`/search/albums?${query}`, { token })
  return listFromPayload(payload).map((entry) => {
    const artistCredits = entry['artist-credit'] || entry.artist_credit || []
    const artist = Array.isArray(artistCredits)
      ? artistCredits.map((credit) => `${credit.name || credit.artist?.name || ''}${credit.joinphrase || ''}`).join('').trim()
      : String(artistCredits || entry.artist || '')
    const mbid = entry.mbid || entry.id || entry['release-group']?.id || ''
    const coverCandidates = [
      mbid && `https://coverartarchive.org/release-group/${encodeURIComponent(mbid)}/front-250`,
      ...(Array.isArray(entry.releases) ? entry.releases.map((release) => release.id && `https://coverartarchive.org/release/${encodeURIComponent(release.id)}/front-250`) : []),
    ].filter(Boolean)
    return {
      ...entry,
      mbid,
      title: entry.title || entry.name || entry.album_title || '',
      artist: entry.artist || artist,
      year: entry.year || entry['first-release-date']?.slice(0, 4) || '',
      image: normalizeArtworkUrl(entry.image || entry.image_url || entry.cover_url || coverCandidates[0] || ''),
      coverCandidates,
    }
  })
}

export async function searchArtists(queryText, limit = 6) {
  const query = new URLSearchParams({ query: queryText, limit: String(limit) })
  const payload = await apiRequest(`/search/artists?${query}`)
  const artists = Array.isArray(payload?.artists) ? payload.artists : listFromPayload(payload)
  return artists.filter((entry) => entry && typeof entry === 'object').map((entry) => {
    const artist = entry.artist || entry
    return {
      ...entry,
      mbid: entry.mbid || entry.id || artist.id || '',
      title: entry.title || entry.name || artist.name || 'Unknown artist',
    }
  }).filter((artist) => artist.mbid && artist.title)
}

export async function searchSongs(queryText, limit = 10) {
  const query = new URLSearchParams({ query: queryText, limit: String(limit) })
  const payload = await apiRequest(`/search/songs?${query}`)
  return listFromPayload(payload).map((entry) => {
    const artistCredits = entry['artist-credit'] || entry.artist_credit || []
    const artist = Array.isArray(artistCredits)
      ? artistCredits.map((credit) => `${credit.name || credit.artist?.name || ''}${credit.joinphrase || ''}`).join('').trim()
      : String(artistCredits || entry.artist || '')
    const mbid = entry.mbid || entry.id || entry.recording?.id || ''
    const release = entry.releases?.[0]
    const releaseGroupId = release?.['release-group']?.id
    return {
      ...entry,
      mbid,
      title: entry.title || entry.name || '',
      artist: entry.artist || artist,
      album: release?.title || '',
      image: normalizeArtworkUrl(entry.image || entry.image_url || entry.cover_url || (releaseGroupId ? `https://coverartarchive.org/release-group/${releaseGroupId}/front-250` : '')),
    }
  })
}

export { TOKEN_KEY }
