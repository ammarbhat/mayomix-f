const API_ROOT = '/api'
const TOKEN_KEY = 'mayomix.access_token'
const TOKEN_TYPE_KEY = 'mayomix.token_type'

export async function apiRequest(path, { token, ...options } = {}) {
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
    throw new Error(message)
  }

  return payload
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
  for (const key of ['items', 'results', 'entries', 'data', 'taste', 'users', 'reviews', 'songs', 'liked_songs', 'liked', 'recordings', 'release-groups']) {
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
  if (!item.mbid) return item
  const key = `${kind}:${item.mbid}`
  const cached = cachedItem(key)
  if (cached) return {
    ...cached,
    ...item,
    title: cached.title || item.title,
    artist: item.artist || cached.artist,
    image: item.image || cached.image,
    mbid: item.mbid,
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
    const enriched = { ...item, ...metadata, mbid: item.mbid }
    saveCachedItem(key, enriched)
    return enriched
  } catch {
    return item
  }
}

export async function getTasteList(username, category, token) {
  const query = new URLSearchParams({ category })
  const payload = await apiRequest(`/users/${encodeURIComponent(username)}/taste?${query}`, { token })
  let items = listFromPayload(payload).map(itemDetails)

  if (category === 'top_albums' || category === 'rotation_album') {
    items = await Promise.all(items.map((item) => enrichMusicItem(item, 'release-group', token)))
  } else if (category === 'rotation_song') {
    items = await Promise.all(items.map((item) => enrichMusicItem(item, 'recording', token)))
  } else if (category === 'top_artists') {
    items = await Promise.all(items.map((item) => enrichMusicItem(item, 'artist', token)))
  }

  return items
}

export async function getLikedSongs(token) {
  const payload = await apiRequest('/users/me/taste/liked', { token })
  const items = listFromPayload(payload).map((entry) => {
    const item = itemDetails(entry)
    return { ...item, mbid: item.mbid || item.song_mbid || item.recording_mbid || entry?.song?.mbid || entry?.recording?.mbid || '' }
  }).slice(0, 12)
  return Promise.all(items.map((item) => enrichMusicItem(item, 'recording', token)))
}

export async function getUserReviews(username, token) {
  const query = new URLSearchParams({ limit: '50', offset: '0' })
  const payload = await apiRequest(`/users/${encodeURIComponent(username)}/reviews?${query}`, { token })
  return listFromPayload(payload)
}

export async function getAlbumDetails(mbid, token) {
  const payload = await apiRequest(`/albums/${encodeURIComponent(mbid)}`, { token })
  return itemDetails(payload)
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

export { TOKEN_KEY }
