import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { apiRequest, clearStoredToken, getAlbumDetails, signIn } from '../src/api.js'
import { queryClient } from '../src/queryClient.js'
import { describeApiQuery, QUERY_FRESHNESS } from '../src/queryKeys.js'

const originalFetch = globalThis.fetch
const originalDateNow = Date.now
const originalLocalStorage = globalThis.localStorage

function tokenFor(username) {
  const payload = btoa(JSON.stringify({ sub: username })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `header.${payload}.signature`
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  queryClient.clear()
  globalThis.sessionStorage = {
    getItem: () => 'Bearer',
    setItem: () => {},
    removeItem: () => {},
  }
})

afterEach(() => {
  globalThis.fetch = originalFetch
  Date.now = originalDateNow
  if (originalLocalStorage === undefined) delete globalThis.localStorage
  else globalThis.localStorage = originalLocalStorage
  queryClient.clear()
})

test('QueryClient has the requested global freshness and retention defaults', () => {
  const { queries } = queryClient.getDefaultOptions()
  assert.equal(queries.staleTime, 30_000)
  assert.equal(queries.gcTime, 5 * 60_000)
  assert.equal(queries.retry, 1)
  assert.equal(queries.refetchOnWindowFocus, false)
})

test('identical fresh GETs share a request while distinct search terms stay separate', async () => {
  let requests = 0
  globalThis.fetch = async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
    return jsonResponse({ request: ++requests })
  }

  const [first, concurrent] = await Promise.all([
    apiRequest('/search/songs?query=blue&limit=10'),
    apiRequest('/search/songs?query=blue&limit=10'),
  ])
  const repeated = await apiRequest('/search/songs?query=blue&limit=10')
  const different = await apiRequest('/search/songs?query=green&limit=10')

  assert.equal(first.request, 1)
  assert.equal(concurrent.request, 1)
  assert.equal(repeated.request, 1)
  assert.equal(different.request, 2)
})

test('search results become stale after the configured freshness period', async () => {
  let requests = 0
  let now = 1_000_000
  Date.now = () => now
  globalThis.fetch = async () => jsonResponse({ request: ++requests })
  const path = '/search/artists?query=radiohead&limit=6'

  const first = await apiRequest(path)
  now += QUERY_FRESHNESS.search + 1
  const second = await apiRequest(path)

  assert.equal(first.request, 1)
  assert.equal(second.request, 2)
})

test('resource keys and freshness match the requested policy without raw tokens', () => {
  const tokenA = tokenFor('alice')
  const tokenB = tokenFor('bob')

  assert.equal(describeApiQuery('/albums/mbid-1', tokenA).staleTime, 24 * 60 * 60 * 1_000)
  assert.equal(describeApiQuery('/albums/mbid-1/reviews?limit=29&offset=0').staleTime, QUERY_FRESHNESS.reviews)
  assert.equal(describeApiQuery('/users/alice').staleTime, QUERY_FRESHNESS.publicProfiles)
  assert.equal(describeApiQuery('/users/alice/taste?category=top_albums').staleTime, QUERY_FRESHNESS.tasteLists)
  assert.equal(describeApiQuery('/activity?limit=29&offset=0', tokenA).staleTime, QUERY_FRESHNESS.activity)
  assert.equal(describeApiQuery('/search/albums?query=blue&limit=15', tokenA).staleTime, QUERY_FRESHNESS.search)
  assert.equal(describeApiQuery('/connections/me/status/bob', tokenA).staleTime, QUERY_FRESHNESS.connectionStatus)
  assert.equal(describeApiQuery('/users/me', tokenA).staleTime, QUERY_FRESHNESS.currentProfile)

  const aliceActivityKey = describeApiQuery('/activity?limit=29&offset=0', tokenA).queryKey
  const bobActivityKey = describeApiQuery('/activity?limit=29&offset=0', tokenB).queryKey
  assert.notDeepEqual(aliceActivityKey, bobActivityKey)
  assert.equal(JSON.stringify(aliceActivityKey).includes(tokenA), false)
})

test('taste mutations invalidate only the affected category and related liked taste', async () => {
  globalThis.fetch = async () => jsonResponse({ message: 'saved' })
  const token = tokenFor('alice')
  const albumTaste = ['user', 'alice', 'taste', 'top_albums']
  const artistTaste = ['user', 'alice', 'taste', 'top_artists']
  const likedTaste = ['private', 'alice', 'likedTaste']
  const unrelatedUserTaste = ['user', 'bob', 'taste', 'top_albums']
  queryClient.setQueryData(albumTaste, [{ mbid: 'album-1' }])
  queryClient.setQueryData(artistTaste, [{ mbid: 'artist-1' }])
  queryClient.setQueryData(likedTaste, [])
  queryClient.setQueryData(unrelatedUserTaste, [])

  await apiRequest('/users/me/taste?category=top_albums', {
    method: 'POST', token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mbid: 'album-2', rank: 1 }),
  })

  assert.equal(queryClient.getQueryState(albumTaste).isInvalidated, true)
  assert.equal(queryClient.getQueryState(likedTaste).isInvalidated, true)
  assert.equal(queryClient.getQueryState(artistTaste).isInvalidated, false)
  assert.equal(queryClient.getQueryState(unrelatedUserTaste).isInvalidated, false)
})

test('taste edits and removals invalidate the current users taste lists', async () => {
  globalThis.fetch = async () => jsonResponse({ message: 'updated' })
  const token = tokenFor('alice')
  const albumTaste = ['user', 'alice', 'taste', 'top_albums']
  const artistTaste = ['user', 'alice', 'taste', 'top_artists']

  for (const method of ['PATCH', 'DELETE']) {
    queryClient.setQueryData(albumTaste, [{ id: 9, mbid: 'album-1' }])
    queryClient.setQueryData(artistTaste, [{ id: 10, mbid: 'artist-1' }])
    await apiRequest('/users/me/taste/9', { method, token })
    assert.equal(queryClient.getQueryState(albumTaste).isInvalidated, true)
    assert.equal(queryClient.getQueryState(artistTaste).isInvalidated, true)
  }
})

test('review creation invalidates that album, the author review list, and activity only', async () => {
  globalThis.fetch = async () => jsonResponse({ id: 91 })
  const token = tokenFor('alice')
  const albumReviews = ['album', 'album-1', 'reviews', { limit: '29', offset: '0' }]
  const otherAlbumReviews = ['album', 'album-2', 'reviews', { limit: '29', offset: '0' }]
  const userReviews = ['user', 'alice', 'reviews', { limit: '29', offset: '0' }]
  const activity = ['private', 'alice', 'activity', { limit: '29', offset: '0' }]
  for (const key of [albumReviews, otherAlbumReviews, userReviews, activity]) queryClient.setQueryData(key, [])

  await apiRequest('/users/me/reviews', {
    method: 'POST', token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mbid: 'album-1', rating: 8, review_str: 'Good record' }),
  })

  assert.equal(queryClient.getQueryState(albumReviews).isInvalidated, true)
  assert.equal(queryClient.getQueryState(userReviews).isInvalidated, true)
  assert.equal(queryClient.getQueryState(activity).isInvalidated, true)
  assert.equal(queryClient.getQueryState(otherAlbumReviews).isInvalidated, false)
})

test('review edits and deletions invalidate the matching album review cache', async () => {
  globalThis.fetch = async () => jsonResponse({ message: 'updated' })
  const token = tokenFor('alice')
  const albumReviews = ['album', 'album-1', 'reviews', { limit: '29', offset: '0' }]
  const otherAlbumReviews = ['album', 'album-2', 'reviews', { limit: '29', offset: '0' }]

  for (const method of ['PATCH', 'DELETE']) {
    queryClient.setQueryData(albumReviews, [])
    queryClient.setQueryData(otherAlbumReviews, [])
    await apiRequest('/users/me/reviews/90', { method, token, invalidationContext: { albumMbid: 'album-1' } })
    assert.equal(queryClient.getQueryState(albumReviews).isInvalidated, true)
    assert.equal(queryClient.getQueryState(otherAlbumReviews).isInvalidated, false)
  }
})

test('profile updates invalidate private, public, and user-search results', async () => {
  globalThis.fetch = async () => jsonResponse({ name: 'New name' })
  const token = tokenFor('alice')
  const privateProfile = ['private', 'alice', 'me']
  const publicProfile = ['user', 'alice', 'profile']
  const otherProfile = ['user', 'bob', 'profile']
  const userSearch = ['search', 'users', { username: 'ali' }]
  for (const key of [privateProfile, publicProfile, otherProfile, userSearch]) queryClient.setQueryData(key, {})

  await apiRequest('/users/me', {
    method: 'PATCH', token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'New name' }),
  })

  assert.equal(queryClient.getQueryState(privateProfile).isInvalidated, true)
  assert.equal(queryClient.getQueryState(publicProfile).isInvalidated, true)
  assert.equal(queryClient.getQueryState(userSearch).isInvalidated, true)
  assert.equal(queryClient.getQueryState(otherProfile).isInvalidated, false)
})

test('connection mutations refresh status and lists, and acceptance refreshes activity', async () => {
  globalThis.fetch = async () => jsonResponse({ message: 'updated' })
  const token = tokenFor('alice')
  const status = ['private', 'alice', 'connectionStatus', 'bob']
  const pending = ['private', 'alice', 'connections', 'pending']
  const activity = ['private', 'alice', 'activity', { limit: '29', offset: '0' }]
  for (const key of [status, pending, activity]) queryClient.setQueryData(key, [])

  await apiRequest('/connections/42', { method: 'POST', token, invalidationContext: { connectionUsername: 'bob' } })
  assert.equal(queryClient.getQueryState(status).isInvalidated, true)
  assert.equal(queryClient.getQueryState(pending).isInvalidated, true)
  assert.equal(queryClient.getQueryState(activity).isInvalidated, false)

  for (const key of [status, pending, activity]) queryClient.setQueryData(key, [])
  await apiRequest('/connections/42/accept', { method: 'PATCH', token })
  assert.equal(queryClient.getQueryState(status).isInvalidated, true)
  assert.equal(queryClient.getQueryState(pending).isInvalidated, true)
  assert.equal(queryClient.getQueryState(activity).isInvalidated, true)

  const acceptedConnections = ['private', 'alice', 'connections', 'accepted']
  queryClient.setQueryData(status, [])
  queryClient.setQueryData(pending, [])
  queryClient.setQueryData(activity, [])
  queryClient.setQueryData(acceptedConnections, [{ id: 42, accepted: false }])
  await apiRequest('/connections/42', { method: 'DELETE', token })
  assert.equal(queryClient.getQueryState(activity).isInvalidated, false)

  queryClient.setQueryData(activity, [])
  queryClient.setQueryData(acceptedConnections, [{ id: 42, accepted: true }])
  await apiRequest('/connections/42', { method: 'DELETE', token })
  assert.equal(queryClient.getQueryState(activity).isInvalidated, true)
})

test('a completed mutation cancels an older GET before it can restore stale data', async () => {
  const token = tokenFor('alice')
  let getStarted
  let aborted = false
  const started = new Promise((resolve) => { getStarted = resolve })
  globalThis.fetch = (url, options) => {
    if (options.method === 'PATCH') return Promise.resolve(jsonResponse({ name: 'Updated' }))
    return new Promise((resolve, reject) => {
      getStarted()
      if (options.signal.aborted) {
        aborted = true
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      options.signal.addEventListener('abort', () => {
        aborted = true
        reject(new DOMException('Aborted', 'AbortError'))
      }, { once: true })
    })
  }

  const getRequest = apiRequest('/users/me', { token })
  await started
  await apiRequest('/users/me', {
    method: 'PATCH', token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Updated' }),
  })
  await getRequest.catch(() => {})

  const profileQuery = queryClient.getQueryCache().find({ queryKey: ['private', 'alice', 'me'], exact: true })
  assert.equal(aborted, true)
  assert.equal(profileQuery.state.data, undefined)
  assert.equal(profileQuery.state.isInvalidated, true)
})

test('logout removes private data but retains public caches', () => {
  const privateActivity = ['private', 'alice', 'activity', { limit: '29', offset: '0' }]
  const publicProfile = ['user', 'alice', 'profile']
  queryClient.setQueryData(privateActivity, [{ id: 1 }])
  queryClient.setQueryData(publicProfile, { username: 'alice' })

  clearStoredToken()

  assert.equal(queryClient.getQueryState(privateActivity), undefined)
  assert.deepEqual(queryClient.getQueryData(publicProfile), { username: 'alice' })
})

test('signing into another account clears previous private query data', async () => {
  const aliceActivity = ['private', 'alice', 'activity', { limit: '29', offset: '0' }]
  const bobActivity = ['private', 'bob', 'activity', { limit: '29', offset: '0' }]
  queryClient.setQueryData(aliceActivity, [{ id: 'alice-item' }])
  queryClient.setQueryData(bobActivity, [{ id: 'bob-item' }])
  globalThis.fetch = async () => jsonResponse({ access_token: tokenFor('bob'), token_type: 'bearer' })

  await signIn('bob', 'password')

  assert.equal(queryClient.getQueryState(aliceActivity), undefined)
  assert.equal(queryClient.getQueryState(bobActivity), undefined)
})

test('failed requests are not cached as data and can be retried by a later call', async () => {
  let requests = 0
  globalThis.fetch = async () => {
    requests += 1
    return requests <= 2 ? jsonResponse({ detail: 'temporary failure' }, 500) : jsonResponse({ ok: true })
  }

  await assert.rejects(apiRequest('/users/alice'))
  const result = await apiRequest('/users/alice')

  assert.equal(result.ok, true)
  assert.equal(requests, 3)
})

test('album metadata stays fresh for 24 hours, then refetches', async () => {
  let requests = 0
  let now = 5_000_000
  Date.now = () => now
  globalThis.fetch = async () => jsonResponse({ request: ++requests, meta: { title: 'Album' } })

  const first = await getAlbumDetails('album-1')
  const fresh = await getAlbumDetails('album-1')
  now += QUERY_FRESHNESS.albumMetadata + 1
  const stale = await getAlbumDetails('album-1')

  assert.equal(first.request, 1)
  assert.equal(fresh.request, 1)
  assert.equal(stale.request, 2)
})

test('album fallback metadata is cached without another MusicBrainz request', async () => {
  const values = new Map()
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
  const requests = []
  globalThis.fetch = async (url) => {
    requests.push(String(url))
    if (String(url).startsWith('/api/')) return jsonResponse({ detail: 'metadata unavailable' }, 500)
    return jsonResponse({ title: 'Cached album', 'artist-credit': [{ name: 'Cached artist' }] })
  }

  const first = await getAlbumDetails('album-fallback')
  const cached = await getAlbumDetails('album-fallback')

  assert.equal(first.title, 'Cached album')
  assert.equal(cached.title, 'Cached album')
  assert.equal(requests.length, 2)
  assert.ok(values.has('mayomix.musicbrainz-cache.v2'))
})
