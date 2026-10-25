export const QUERY_FRESHNESS = Object.freeze({
  default: 30_000,
  albumMetadata: 24 * 60 * 60 * 1_000,
  reviews: 30_000,
  publicProfiles: 30_000,
  tasteLists: Infinity,
  activity: 20_000,
  search: 30_000,
  connectionStatus: 15_000,
  currentProfile: 30_000,
})

export function getTokenScope(token) {
  if (!token) return null
  try {
    const encodedPayload = token.split('.')[1]
    if (!encodedPayload) return null
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')))
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null
  } catch {
    return null
  }
}

function sortedParams(searchParams) {
  return Object.fromEntries([...searchParams.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

export function describeApiQuery(path, token) {
  const url = new URL(path, 'http://mayomix.local')
  const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
  const params = sortedParams(url.searchParams)
  const scope = getTokenScope(token)

  if (parts[0] === 'albums' && parts.length === 3 && parts[2] === 'reviews') {
    return { queryKey: ['album', parts[1], 'reviews', params], staleTime: QUERY_FRESHNESS.reviews }
  }
  if (parts[0] === 'albums' && parts.length === 2) {
    return { queryKey: ['album', parts[1], 'metadata'], staleTime: QUERY_FRESHNESS.albumMetadata }
  }
  if (parts[0] === 'users' && parts[1] === 'me' && parts.length === 2) {
    return { queryKey: ['private', scope || 'unknown-account', 'me'], staleTime: QUERY_FRESHNESS.currentProfile }
  }
  if (parts[0] === 'users' && parts[1] === 'me' && parts[2] === 'taste' && parts[3] === 'liked') {
    return {
      queryKey: ['private', scope || 'unknown-account', 'likedTaste'],
      staleTime: QUERY_FRESHNESS.tasteLists,
      gcTime: Infinity,
    }
  }
  if (parts[0] === 'users' && parts[1] === 'search') {
    return { queryKey: ['search', 'users', params], staleTime: QUERY_FRESHNESS.search }
  }
  if (parts[0] === 'users' && parts[2] === 'taste') {
    return {
      queryKey: ['user', parts[1], 'taste', params.category || ''],
      staleTime: QUERY_FRESHNESS.tasteLists,
      gcTime: Infinity,
      emptyOnNotFound: true,
    }
  }
  if (parts[0] === 'users' && parts[2] === 'reviews') {
    return { queryKey: ['user', parts[1], 'reviews', params], staleTime: QUERY_FRESHNESS.reviews }
  }
  if (parts[0] === 'users' && parts.length === 2) {
    return { queryKey: ['user', parts[1], 'profile'], staleTime: QUERY_FRESHNESS.publicProfiles }
  }
  if (parts[0] === 'search') {
    if (parts[1] === 'albums') {
      return { queryKey: ['private', scope || 'unknown-account', 'search', parts[1], params], staleTime: QUERY_FRESHNESS.search }
    }
    return { queryKey: ['search', parts[1], params], staleTime: QUERY_FRESHNESS.search }
  }
  if (parts[0] === 'activity') {
    return { queryKey: ['private', scope || 'unknown-account', 'activity', params], staleTime: QUERY_FRESHNESS.activity }
  }
  if (parts[0] === 'connections' && parts[1] === 'me' && parts[2] === 'status') {
    return { queryKey: ['private', scope || 'unknown-account', 'connectionStatus', parts[3] || ''], staleTime: QUERY_FRESHNESS.connectionStatus }
  }
  if (parts[0] === 'connections' && parts[1] === 'me') {
    return { queryKey: ['private', scope || 'unknown-account', 'connections', parts[2] || 'accepted'], staleTime: QUERY_FRESHNESS.connectionStatus }
  }

  return {
    queryKey: scope ? ['private', scope, 'api', url.pathname, params] : ['api', url.pathname, params],
    staleTime: QUERY_FRESHNESS.default,
  }
}

export const queryKeys = Object.freeze({
  albumReviews: (mbid) => ['album', mbid, 'reviews'],
  user: (username) => ['user', username],
  privateAccount: (scope) => ['private', scope],
  privateActivity: (scope) => ['private', scope, 'activity'],
  privateConnections: (scope) => ['private', scope, 'connections'],
  privateConnectionStatuses: (scope) => ['private', scope, 'connectionStatus'],
  privateLikedTaste: (scope) => ['private', scope, 'likedTaste'],
})
