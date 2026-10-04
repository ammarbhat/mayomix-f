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
  for (const key of ['items', 'results', 'entries', 'data', 'taste']) {
    if (Array.isArray(payload[key])) return payload[key]
  }
  if (payload.mbid || payload.title || payload.name || payload.id) return [payload]
  return Object.values(payload).filter((value) => value && typeof value === 'object')
}

export function itemDetails(entry) {
  if (!entry || typeof entry !== 'object') return { title: String(entry ?? '') }
  const nested = entry.album || entry.song || entry.artist || entry.genre || entry.item || entry.recording || entry
  const item = nested && typeof nested === 'object' ? nested : entry
  return {
    ...entry,
    ...item,
    title: item.title || item.name || item.album_title || item.song_title || entry.title || entry.name || entry.label || entry.mbid || '',
    image: item.image || item.image_url || item.cover_url || item.cover_art_url || item.artwork_url || item.thumbnail || entry.image || entry.image_url || entry.cover_url || entry.artwork_url || entry.thumbnail || '',
  }
}

export async function getTasteList(username, category, token) {
  const query = new URLSearchParams({ category })
  const payload = await apiRequest(`/users/${encodeURIComponent(username)}/taste?${query}`, { token })
  let items = listFromPayload(payload).map(itemDetails)

  if (category === 'top_albums' || category === 'rotation_album' || category === 'rotation_song' || category === 'top_artists') {
    items = await Promise.all(items.map(async (item) => {
      if (!item.mbid || item.title !== item.mbid) return item
      try {
        const result = category === 'top_albums' || category === 'rotation_album'
          ? await apiRequest(`/albums/${encodeURIComponent(item.mbid)}`, { token })
          : await apiRequest(`/search/${category === 'top_artists' ? 'artists' : 'songs'}?${new URLSearchParams({ query: item.mbid, limit: '1' })}`, { token })
        const found = category === 'top_albums' || category === 'rotation_album'
          ? result
          : listFromPayload(result).map(itemDetails).find((candidate) => candidate.mbid === item.mbid) || listFromPayload(result).map(itemDetails)[0]
        if (!found) return item
        return {
          ...item,
          ...found,
          title: found.title || found.name || item.title,
          image: found.image || found.image_url || found.cover_url || found.artwork_url || item.image,
        }
      } catch {
        return item
      }
    }))
  }

  return items
}

export { TOKEN_KEY }
