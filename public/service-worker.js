const ALBUM_ART_CACHE = 'mayomix-album-art-v1'
const ALBUM_ART_META_CACHE = 'mayomix-album-art-meta-v1'
const PROFILE_ART_CACHE = 'mayomix-profile-art-v1'
const ALBUM_ART_MAX_AGE = 30 * 24 * 60 * 60 * 1000
const ALBUM_ART_LIMIT = 300
const PROFILE_ART_LIMIT = 20
const profileArtworkJobs = new Map()

function isAlbumArtwork(request) {
  if (request.method !== 'GET') return false

  try {
    const url = new URL(request.url)
    return url.hostname === 'coverartarchive.org'
      && /^\/(?:release|release-group)\/[^/]+\/front(?:-\d+)?\/?$/.test(url.pathname)
  } catch {
    return false
  }
}

async function removeArtworkEntry(artCache, metaCache, request) {
  await Promise.all([artCache.delete(request), metaCache.delete(request)])
}

async function trimArtworkCache(artCache, metaCache) {
  const requests = await artCache.keys()
  const entries = await Promise.all(requests.map(async (request) => {
    const metadata = await metaCache.match(request)
    if (!metadata) {
      await artCache.delete(request)
      return null
    }

    try {
      const { cachedAt } = await metadata.json()
      if (!Number.isFinite(cachedAt) || Date.now() - cachedAt >= ALBUM_ART_MAX_AGE) {
        await removeArtworkEntry(artCache, metaCache, request)
        return null
      }
      return { request, cachedAt }
    } catch {
      await removeArtworkEntry(artCache, metaCache, request)
      return null
    }
  }))

  const validEntries = entries.filter(Boolean).sort((left, right) => right.cachedAt - left.cachedAt)
  await Promise.all(validEntries.slice(ALBUM_ART_LIMIT).map(({ request }) => (
    removeArtworkEntry(artCache, metaCache, request)
  )))
}

async function storeArtworkResponse(artCache, metaCache, request, response) {
  try {
    await Promise.all([
      artCache.put(request, response),
      metaCache.put(request, new Response(JSON.stringify({ cachedAt: Date.now() }), {
        headers: { 'Content-Type': 'application/json' },
      })),
    ])
    if ((await artCache.keys()).length > ALBUM_ART_LIMIT) {
      await trimArtworkCache(artCache, metaCache)
    }
  } catch {
    // Storage limits should never prevent the image from loading.
  }
}

async function cacheProfileArtwork(urls) {
  const [profileCache, artCache] = await Promise.all([
    caches.open(PROFILE_ART_CACHE),
    caches.open(ALBUM_ART_CACHE),
  ])
  await Promise.all(urls.map(async (url) => {
    if (profileArtworkJobs.has(url)) return profileArtworkJobs.get(url)
    const job = (async () => {
      const request = new Request(url, { mode: 'no-cors' })
      if (await profileCache.match(request)) return
      const existingArtwork = await artCache.match(request)
      if (existingArtwork) {
        await profileCache.put(request, existingArtwork.clone())
        return
      }
      const response = await fetch(request)
      if (response.ok || response.type === 'opaque') await profileCache.put(request, response.clone())
    })().catch(() => {})
      .finally(() => profileArtworkJobs.delete(url))
    profileArtworkJobs.set(url, job)
    return job
  }))

  const requests = await profileCache.keys()
  await Promise.all(requests.slice(0, Math.max(0, requests.length - PROFILE_ART_LIMIT))
    .map((request) => profileCache.delete(request)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames
      .filter((name) => name.startsWith('mayomix-album-art-')
        && name !== ALBUM_ART_CACHE
        && name !== ALBUM_ART_META_CACHE)
      .map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_PROFILE_ARTWORK' || !Array.isArray(event.data.urls)) return
  const urls = [...new Set(event.data.urls.filter((url) => typeof url === 'string'
    && isAlbumArtwork(new Request(url))))]
  event.waitUntil(cacheProfileArtwork(urls))
})

self.addEventListener('fetch', (event) => {
  if (!isAlbumArtwork(event.request)) return

  let finishCacheWrite
  event.waitUntil(new Promise((resolve) => { finishCacheWrite = resolve }))
  event.respondWith((async () => {
    let cachedResponse = null
    try {
      const [profileCache, artCache, metaCache] = await Promise.all([
        caches.open(PROFILE_ART_CACHE),
        caches.open(ALBUM_ART_CACHE),
        caches.open(ALBUM_ART_META_CACHE),
      ])
      const pinnedProfileResponse = await profileCache.match(event.request)
      cachedResponse = pinnedProfileResponse || await artCache.match(event.request)

      if (cachedResponse) {
        if (pinnedProfileResponse) {
          finishCacheWrite()
          return cachedResponse
        }
        const metadata = await metaCache.match(event.request)
        let cachedAt
        try { cachedAt = (await metadata?.json())?.cachedAt ?? null } catch { cachedAt = null }
        if (Number.isFinite(cachedAt) && Date.now() - cachedAt < ALBUM_ART_MAX_AGE) {
          finishCacheWrite()
          return cachedResponse
        }
      }

      const response = await fetch(event.request)
      if (response.ok || response.type === 'opaque') {
        storeArtworkResponse(artCache, metaCache, event.request, response.clone())
          .finally(finishCacheWrite)
      } else {
        finishCacheWrite()
      }
      return response
    } catch (error) {
      finishCacheWrite()
      if (cachedResponse) return cachedResponse
      throw error
    }
  })())
})
