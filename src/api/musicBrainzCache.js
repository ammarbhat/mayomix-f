export const MUSICBRAINZ_CACHE_TTL = 24 * 60 * 60 * 1_000
export const MUSICBRAINZ_CACHE_LIMIT = 300

const CACHE_KEY = 'mayomix.musicbrainz-cache.v2'
const LEGACY_CACHE_KEY = 'mayomix.musicbrainz-cache'
const METADATA_FIELDS = ['title', 'artist', 'album', 'image', 'mbid']

function getStorage(storage) {
  if (storage !== undefined) return storage
  try { return globalThis.localStorage } catch { return null }
}

function writeEntries(storage, entries) {
  try { storage.setItem(CACHE_KEY, JSON.stringify(entries)) } catch { /* Storage can be unavailable or full. */ }
}

export function readMusicBrainzCache({ storage: requestedStorage, now = Date.now() } = {}) {
  const storage = getStorage(requestedStorage)
  if (!storage) return {}
  try {
    if (storage.getItem(LEGACY_CACHE_KEY) !== null) storage.removeItem(LEGACY_CACHE_KEY)
    const serialized = storage.getItem(CACHE_KEY)
    if (!serialized) return {}
    const parsed = JSON.parse(serialized)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      storage.removeItem(CACHE_KEY)
      return {}
    }
    const entries = Object.entries(parsed)
      .filter(([, entry]) => entry
        && Number.isFinite(entry.savedAt)
        && entry.savedAt <= now
        && now - entry.savedAt < MUSICBRAINZ_CACHE_TTL
        && entry.value
        && typeof entry.value === 'object'
        && METADATA_FIELDS.some((field) => typeof entry.value[field] === 'string' && entry.value[field]))
      .sort(([, left], [, right]) => right.savedAt - left.savedAt)
      .slice(0, MUSICBRAINZ_CACHE_LIMIT)
    const valid = Object.fromEntries(entries)
    if (entries.length !== Object.keys(parsed).length) writeEntries(storage, valid)
    return valid
  } catch {
    try { storage.removeItem(CACHE_KEY) } catch { /* Storage may be read-only. */ }
    return {}
  }
}

export function getMusicBrainzCacheItem(key, options) {
  return readMusicBrainzCache(options)[key]?.value || null
}

export function saveMusicBrainzCacheItem(key, value, { storage: requestedStorage, now = Date.now() } = {}) {
  const storage = getStorage(requestedStorage)
  if (!storage) return
  const cache = readMusicBrainzCache({ storage, now })
  const metadata = Object.fromEntries(METADATA_FIELDS
    .filter((field) => value?.[field] != null)
    .map((field) => [field, value[field]]))
  if (!METADATA_FIELDS.some((field) => typeof metadata[field] === 'string' && metadata[field])) return
  cache[key] = { value: metadata, savedAt: now }
  const bounded = Object.fromEntries(Object.entries(cache)
    .sort(([, left], [, right]) => right.savedAt - left.savedAt)
    .slice(0, MUSICBRAINZ_CACHE_LIMIT))
  writeEntries(storage, bounded)
}
