import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function clearPrivateQueriesExcept(scopeToKeep = null) {
  return queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] === 'private'
      && (scopeToKeep === null || query.queryKey[1] !== scopeToKeep),
  })
}
