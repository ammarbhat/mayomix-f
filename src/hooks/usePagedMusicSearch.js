import { useCallback, useEffect, useRef, useState } from 'react'

const RETRY_DELAY_MS = 1800
const EMPTY_PAGE_RETRY_DELAY_MS = 1000
const MAX_EMPTY_PAGE_RETRIES = 1

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function isTerminalError(error) {
  const status = Number(error?.status)
  return status >= 400 && status < 500 && status !== 408 && status !== 429
}

function isMusicBrainzBusyError(error) {
  return /the musicbrainz web server is currently busy\. please try again later\./i.test(String(error?.message || ''))
}

function itemKey(item) {
  return item?.mbid || item?.id || item?.recording_mbid || item?.artist?.id || ''
}

export default function usePagedMusicSearch() {
  const requestId = useRef(0)
  const activeSearch = useRef(null)
  const pagePending = useRef(false)
  const seenKeys = useRef(new Set())
  const nextOffset = useRef(0)
  const loadMoreRef = useRef(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [resultsRoot, setResultsRoot] = useState(null)
  const [sentinelNode, setSentinelNode] = useState(null)
  const resultsRef = useCallback((node) => setResultsRoot(node), [])
  const sentinelRef = useCallback((node) => setSentinelNode(node), [])

  const fetchPage = useCallback(async (search, offset, isFirstPage) => {
    const id = search.id
    let emptyPageRetries = 0
    if (isFirstPage) setLoading(true)
    else setLoadingMore(true)

    pagePending.current = true
    while (requestId.current === id) {
      try {
        const page = await search.fetchPage(search.term, offset, search.pageSize)
        if (requestId.current !== id) return
        if (!Array.isArray(page)) throw new Error('Search returned an invalid result list.')

        if (page.length === 0) {
          if (isFirstPage && emptyPageRetries < MAX_EMPTY_PAGE_RETRIES) {
            emptyPageRetries += 1
            await wait(EMPTY_PAGE_RETRY_DELAY_MS)
            continue
          }
          if (isFirstPage) setItems([])
          setError('')
          setHasMore(false)
          pagePending.current = false
          setLoading(false)
          setLoadingMore(false)
          return
        }

        nextOffset.current = offset + page.length
        const additions = page.filter((item) => {
            const key = itemKey(item)
            if (!key || seenKeys.current.has(key)) return false
            seenKeys.current.add(key)
            return true
          })
        setItems((current) => isFirstPage ? additions : [...current, ...additions])
        setError('')
        setHasMore(page.length >= search.pageSize && additions.length > 0)
        pagePending.current = false
        setLoading(false)
        setLoadingMore(false)
        return
      } catch (requestError) {
        if (requestId.current !== id) return
        if (isMusicBrainzBusyError(requestError)) {
          setError('MusicBrainz is busy. Retrying...')
          continue
        }
        if (isTerminalError(requestError)) {
          setError(requestError.message || 'Search could not be completed.')
          setHasMore(false)
          pagePending.current = false
          setLoading(false)
          setLoadingMore(false)
          return
        }
        setError('Search is taking longer than usual. Retrying...')
        await wait(RETRY_DELAY_MS)
      }
    }
  }, [])

  const search = useCallback((term, fetchPageFn, pageSize) => {
    const cleanTerm = String(term || '').trim()
    const id = ++requestId.current
    setItems([])
    seenKeys.current = new Set()
    nextOffset.current = 0
    setError('')
    setHasMore(false)
    setLoading(false)
    setLoadingMore(false)
    pagePending.current = false
    if (!cleanTerm) {
      activeSearch.current = null
      return
    }
    const next = { id, term: cleanTerm, fetchPage: fetchPageFn, pageSize }
    activeSearch.current = next
    void fetchPage(next, 0, true)
  }, [fetchPage])

  const reset = useCallback(() => {
    requestId.current += 1
    activeSearch.current = null
    setItems([])
    seenKeys.current = new Set()
    nextOffset.current = 0
    setError('')
    setHasMore(false)
    setLoading(false)
    setLoadingMore(false)
    pagePending.current = false
  }, [])

  const loadMore = useCallback(() => {
    const current = activeSearch.current
    if (!current || loading || loadingMore || pagePending.current || !hasMore) return
    void fetchPage(current, nextOffset.current, false)
  }, [fetchPage, hasMore, loading, loadingMore])
  loadMoreRef.current = loadMore

  useEffect(() => {
    const node = sentinelNode
    const root = resultsRoot
    if (!node || !root || !hasMore) return undefined

    const checkScrollPosition = () => {
      const remaining = root.scrollHeight - root.scrollTop - root.clientHeight
      if (remaining <= 120) loadMoreRef.current?.()
    }
    root.addEventListener('scroll', checkScrollPosition, { passive: true })
    checkScrollPosition()

    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current?.()
        }, { root, rootMargin: '120px 0px' })
      : null
    observer?.observe(node)
    return () => {
      root.removeEventListener('scroll', checkScrollPosition)
      observer?.disconnect()
    }
  }, [hasMore, resultsRoot, sentinelNode])

  useEffect(() => {
    if (!resultsRoot || !hasMore || loading || loadingMore) return
    const remaining = resultsRoot.scrollHeight - resultsRoot.scrollTop - resultsRoot.clientHeight
    if (remaining <= 120) loadMoreRef.current?.()
  }, [hasMore, items, loading, loadingMore, resultsRoot])

  return { items, loading, loadingMore, error, hasMore, resultsRootCallback: resultsRef, sentinelCallback: sentinelRef, search, reset }
}
