const API_ROOT = '/api'
const TOKEN_KEY = 'mayomix.access_token'
const TOKEN_TYPE_KEY = 'mayomix.token_type'
const GET_CACHE_TTL = 10_000
const getCache = new Map()
const pendingGets = new Map()

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

export function apiRequest(path, { token, cache = true, ...options } = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const key = `${token || 'public'}:${path}`
  if (method !== 'GET') {
    getCache.clear()
    pendingGets.clear()
    return performApiRequest(path, token, options)
  }
  if (!cache) return performApiRequest(path, token, options)

  const cached = getCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value)
  if (pendingGets.has(key)) return pendingGets.get(key)

  const request = performApiRequest(path, token, options).then((value) => {
    getCache.set(key, { value, expiresAt: Date.now() + GET_CACHE_TTL })
    return value
  }).finally(() => pendingGets.delete(key))
  pendingGets.set(key, request)
  return request
}

export async function signIn(username, password) {
  const body = new URLSearchParams({ username, password })
  const tokenData = await apiRequest('/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!tokenData?.access_token) throw new Error('The API did not return an access token.')
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

export function getStoredToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function clearStoredToken() {
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

export function itemDetails(entry) {
  if (!entry || typeof entry !== 'object') return { title: String(entry ?? '') }
  const nested = entry.album || entry.song || entry.artist || entry.genre || entry.item || entry.recording || entry.meta || entry
  const item = nested && typeof nested === 'object' ? nested : entry
  return {
    ...entry,
    ...item,
    title: item.title || item.name || item.album_title || item.song_title || entry.title || entry.name || entry.label || entry.mbid || '',
    image: item.image || item.image_url || item.cover_url || item.cover_art_url || item.artwork_url || item.thumbnail || entry.image || entry.image_url || entry.cover_url || entry.artwork_url || entry.thumbnail || '',
  }
}

const MUSICBRAINZ_ROOT = 'https://musicbrainz.org/ws/2'
const MUSICBRAINZ_CACHE_KEY = 'mayomix.musicbrainz-cache'
let musicBrainzQueue = Promise.resolve()
let lastMusicBrainzRequest = 0

function cachedMusicBrainzData() {
  try {
    return JSON.parse(localStorage.getItem(MUSICBRAINZ_CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function requestMusicBrainz(path) {
  const request = musicBrainzQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastMusicBrainzRequest))
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
    lastMusicBrainzRequest = Date.now()
    const response = await fetch(`${MUSICBRAINZ_ROOT}/${path}`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`MusicBrainz request failed (${response.status})`)
    return response.json()
  })
  musicBrainzQueue = request.catch(() => {})
  return request
}

function artistCreditName(credits = []) {
  return credits.map((credit) => `${credit.name || credit.artist?.name || ''}${credit.joinphrase || ''}`).join('').trim()
}

function cachedItem(key) {
  return cachedMusicBrainzData()[key]
}

function saveCachedItem(key, value) {
  const cache = cachedMusicBrainzData()
  cache[key] = value
  try {
    localStorage.setItem(MUSICBRAINZ_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Storage can be unavailable or full; metadata can still render this session.
  }
}

async function lookupAlbum(mbid) {
  try {
    const releaseGroup = await requestMusicBrainz(`release-group/${encodeURIComponent(mbid)}?inc=artist-credits&fmt=json`)
    return {
      title: releaseGroup.title,
      artist: artistCreditName(releaseGroup['artist-credit']),
      image: `https://coverartarchive.org/release-group/${encodeURIComponent(mbid)}/front-250`,
    }
  } catch {
    const release = await requestMusicBrainz(`release/${encodeURIComponent(mbid)}?inc=artist-credits&fmt=json`)
    const releaseGroupId = release['release-group']?.id
    return {
      title: release.title,
      artist: artistCreditName(release['artist-credit']),
      image: releaseGroupId
        ? `https://coverartarchive.org/release-group/${releaseGroupId}/front-250`
        : `https://coverartarchive.org/release/${encodeURIComponent(mbid)}/front-250`,
    }
  }
}

async function lookupSong(mbid) {
  const recording = await requestMusicBrainz(`recording/${encodeURIComponent(mbid)}?inc=artist-credits+releases&fmt=json`)
  const release = recording.releases?.find((entry) => entry['release-group']?.id) || recording.releases?.[0]
  const releaseGroupId = release?.['release-group']?.id
  return {
    title: recording.title,
    artist: artistCreditName(recording['artist-credit']),
    album: release?.title || '',
    image: releaseGroupId
      ? `https://coverartarchive.org/release-group/${releaseGroupId}/front-250`
      : release?.id
        ? `https://coverartarchive.org/release/${release.id}/front-250`
        : '',
  }
}

async function lookupArtist(mbid) {
  const artist = await requestMusicBrainz(`artist/${encodeURIComponent(mbid)}?fmt=json`)
  return { title: artist.name }
}

async function serviceMetadata(item, kind, token) {
  if (!token) return null
  try {
    if (kind === 'release-group') {
      return await apiRequest(`/albums/${encodeURIComponent(item.mbid)}`, { token })
    }
    const category = kind === 'recording' ? 'songs' : 'artists'
    const payload = await apiRequest(`/search/${category}?${new URLSearchParams({ query: item.mbid, limit: '1' })}`, { token })
    const candidates = listFromPayload(payload).map(itemDetails)
    return candidates.find((candidate) => candidate.mbid === item.mbid) || candidates[0] || null
  } catch {
    return null
  }
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
    image: item.image || cached.image,
    mbid: item.mbid,
    metadataLoading: false,
    metadataLoaded: true,
  }
  try {
    const serviceResult = await serviceMetadata(item, kind, token)
    const serviceItem = serviceResult ? itemDetails(serviceResult) : null
    let metadata
    if (serviceItem && (serviceItem.title !== item.mbid || serviceItem.image)) {
      metadata = serviceItem
      if (!serviceItem.image && kind !== 'artist') {
        try {
          const musicBrainzData = kind === 'recording' ? await lookupSong(item.mbid) : await lookupAlbum(item.mbid)
          metadata = { ...musicBrainzData, ...serviceItem, image: serviceItem.image || musicBrainzData.image }
        } catch {
          // Keep the app API metadata and let the artwork placeholder show.
        }
      }
    } else {
      metadata = kind === 'recording'
        ? await lookupSong(item.mbid)
        : kind === 'artist'
          ? await lookupArtist(item.mbid)
          : await lookupAlbum(item.mbid)
    }
    const enriched = { ...item, ...metadata, id: item.id, rank: item.rank, liked: item.liked, mbid: item.mbid, metadataLoading: false, metadataLoaded: true }
    saveCachedItem(key, enriched)
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

export async function getUserReviews(username, token) {
  const query = new URLSearchParams({ limit: '50', offset: '0' })
  const payload = await apiRequest(`/users/${encodeURIComponent(username)}/reviews?${query}`, { token })
  return listFromPayload(payload)
}

export async function getAlbumReviews(mbid, token) {
  const query = new URLSearchParams({ limit: '50', offset: '0' })
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
  return apiRequest(`/connections/me/status/${encodeURIComponent(username)}`, { token })
}

export async function getActivity(token) {
  const query = new URLSearchParams({ limit: '50', offset: '0' })
  try {
    return listFromPayload(await apiRequest(`/activity?${query}`, { token }))
  } catch (error) {
    if (/404|not found/i.test(error.message)) return []
    throw error
  }
}

async function getConnectionList(path, token) {
  try {
    return listFromPayload(await apiRequest(path, { token, cache: false }))
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

export function acceptConnectionRequest(connectionId, token) {
  return apiRequest(`/connections/${encodeURIComponent(connectionId)}/accept`, { method: 'PATCH', token })
}

export function deleteConnection(connectionId, token) {
  return apiRequest(`/connections/${encodeURIComponent(connectionId)}`, { method: 'DELETE', token })
}

export async function sendConnectionRequest(token, userId) {
  if (userId === undefined || userId === null) {
    throw new Error('The public profile response does not include a user ID, so a connection request cannot be sent yet.')
  }
  return apiRequest(`/connections/${encodeURIComponent(userId)}`, { method: 'POST', token })
}

export async function getAlbumDetails(mbid, token) {
  try {
    const payload = await apiRequest(`/albums/${encodeURIComponent(mbid)}`, { token })
    return itemDetails(payload)
  } catch (error) {
    // Album lookup is backed by an unreliable cache endpoint; keep the page usable
    // by resolving the same MBID directly through the existing MusicBrainz client.
    try {
      return { ...await lookupAlbum(mbid), mbid }
    } catch {
      throw error
    }
  }
}

export async function getAlbumTracklist(mbid, album) {
  const releases = album?.releases || album?.meta?.releases || []
  let releaseId = releases.find((release) => release.id)?.id
  if (!releaseId) {
    const group = await requestMusicBrainz(`release-group/${encodeURIComponent(mbid)}?inc=releases&fmt=json`)
    releaseId = group.releases?.find((release) => release.id)?.id
  }
  if (!releaseId) return []
  const release = await requestMusicBrainz(`release/${encodeURIComponent(releaseId)}?inc=recordings&fmt=json`)
  return (release.media || []).flatMap((medium) => medium.tracks || [])
}

export async function searchUsers(username) {
  const query = new URLSearchParams({ username })
  const payload = await apiRequest(`/users/search?${query}`)
  return listFromPayload(payload)
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
      image: entry.image || entry.image_url || entry.cover_url || coverCandidates[0] || '',
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
      image: entry.image || entry.image_url || entry.cover_url || (releaseGroupId ? `https://coverartarchive.org/release-group/${releaseGroupId}/front-250` : ''),
    }
  })
}

export { TOKEN_KEY }
