import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getMusicBrainzCacheItem,
  MUSICBRAINZ_CACHE_LIMIT,
  MUSICBRAINZ_CACHE_TTL,
  readMusicBrainzCache,
  saveMusicBrainzCacheItem,
} from '../src/musicBrainzCache.js'

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  }
}

test('MusicBrainz metadata expires after 24 hours and stores metadata only', () => {
  const storage = createStorage()
  const savedAt = 100_000
  saveMusicBrainzCacheItem('release-group:album-1', {
    title: 'Album', artist: 'Artist', image: 'https://cover.example/front', rank: 2, liked: true, user_id: 4,
  }, { storage, now: savedAt })

  const stored = JSON.parse(storage.getItem('mayomix.musicbrainz-cache.v2'))
  assert.deepEqual(stored['release-group:album-1'].value, {
    title: 'Album', artist: 'Artist', image: 'https://cover.example/front',
  })
  assert.deepEqual(getMusicBrainzCacheItem('release-group:album-1', { storage, now: savedAt + MUSICBRAINZ_CACHE_TTL - 1 }), {
    title: 'Album', artist: 'Artist', image: 'https://cover.example/front',
  })
  assert.equal(getMusicBrainzCacheItem('release-group:album-1', { storage, now: savedAt + MUSICBRAINZ_CACHE_TTL }), null)
  assert.deepEqual(JSON.parse(storage.getItem('mayomix.musicbrainz-cache.v2')), {})
})

test('MusicBrainz metadata cache stays bounded and drops oldest entries', () => {
  const storage = createStorage()
  for (let index = 0; index <= MUSICBRAINZ_CACHE_LIMIT; index += 1) {
    saveMusicBrainzCacheItem(`artist:${index}`, { title: `Artist ${index}` }, { storage, now: 1_000 + index })
  }

  const stored = JSON.parse(storage.getItem('mayomix.musicbrainz-cache.v2'))
  assert.equal(Object.keys(stored).length, MUSICBRAINZ_CACHE_LIMIT)
  assert.equal(stored['artist:0'], undefined)
  assert.ok(stored[`artist:${MUSICBRAINZ_CACHE_LIMIT}`])
})

test('malformed and legacy MusicBrainz entries are discarded safely', () => {
  const storage = createStorage({
    'mayomix.musicbrainz-cache': JSON.stringify({ old: { title: 'Old shape' } }),
    'mayomix.musicbrainz-cache.v2': '{malformed',
  })

  assert.deepEqual(readMusicBrainzCache({ storage, now: 20_000 }), {})
  assert.equal(storage.getItem('mayomix.musicbrainz-cache'), null)
  assert.equal(storage.getItem('mayomix.musicbrainz-cache.v2'), null)
})
