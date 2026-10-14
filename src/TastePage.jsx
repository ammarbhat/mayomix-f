import { useEffect, useMemo, useRef, useState } from 'react'
import AppHeader from './AppHeader.jsx'
import RatingVinyls from './RatingVinyls.jsx'
import { addTasteItem, apiRequest, clearStoredToken, getMyTasteList, getStoredToken, getUserReviews, itemDetails, removeTasteItem, searchAlbums, searchSongs, updateTasteItem } from './api.js'
import './TastePage.css'

const sections = [
  { key: 'top_albums', title: 'Top Albums', kind: 'album', max: 3 },
  { key: 'rotation_album', title: 'Rotation', kind: 'album', max: 3 },
  { key: 'rotation_song', title: 'Songs', kind: 'song', max: 3 },
]
const emptyTaste = () => Object.fromEntries(sections.map(({ key }) => [key, []]))
const identity = (item) => item.mbid || item.id
const cloneTaste = (taste) => Object.fromEntries(sections.map(({ key }) => [key, (taste[key] || []).map((item) => ({ ...item }))]))
const sameTaste = (left, right) => sections.every(({ key }) => {
  const a = left[key] || []
  const b = right[key] || []
  return a.length === b.length && a.every((item, index) => identity(item) === identity(b[index]))
})
const isEmptyResponse = (error) => /404|not found/i.test(error?.message || '')

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.2" /><path d="m16.2 16.2 5 5" /></svg>
}

function ResultCard({ item, draft, ratings, options, onAdd }) {
  const [open, setOpen] = useState(false)
  const mbid = identity(item)
  const title = item.title || 'Untitled'
  const artist = item.artist || item.album || 'Unknown artist'
  const alreadyInEveryOption = options.every(({ key }) => draft[key].some((entry) => identity(entry) === mbid))

  return <article className="taste-result-card">
    <div className="taste-result-art">
      {item.image && <img src={item.image} alt={`${title} cover`} loading="lazy" onError={(event) => event.currentTarget.remove()} />}
      <span aria-hidden="true">♫</span>
    </div>
    <div className="taste-result-copy">
      <h3 title={title}>{title}</h3>
      <p title={artist}>{artist}</p>
      {ratings[mbid] != null && <RatingVinyls rating={ratings[mbid]} size="small" className="taste-result-vinyls" />}
    </div>
    <div className="taste-add-wrap">
      <button type="button" className="taste-add-button" aria-label={`Add ${title}`} aria-expanded={open} aria-haspopup="menu" disabled={!mbid || alreadyInEveryOption} onClick={() => setOpen((current) => !current)}>{alreadyInEveryOption ? '✓' : '+'}</button>
      {open && <div className="taste-add-menu" role="menu" aria-label={`Add ${title} to`}>
        {options.map((section) => {
          const full = draft[section.key].length >= section.max
          const duplicate = draft[section.key].some((entry) => identity(entry) === mbid)
          return <button type="button" role="menuitem" key={section.key} disabled={full || duplicate} onClick={() => { onAdd(section.key, item); setOpen(false) }}>
            <span>{section.title}</span><small>{duplicate ? 'Added' : full ? 'Full' : `${draft[section.key].length}/${section.max}`}</small>
          </button>
        })}
      </div>}
    </div>
  </article>
}

function SearchPanel({ token, draft, ratings, onAdd }) {
  const [mode, setMode] = useState('album')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  const inputRef = useRef(null)
  const options = useMemo(() => mode === 'album'
    ? sections.slice(0, 2)
    : sections.slice(2), [mode])

  async function submit(event) {
    event?.preventDefault()
    const term = query.trim()
    if (!term) return
    const id = ++requestId.current
    setSubmitted(true)
    setLoading(true)
    setError('')
    try {
      const items = mode === 'album' ? await searchAlbums(term, token) : await searchSongs(term)
      if (requestId.current === id) setResults(items)
    } catch (requestError) {
      if (requestId.current === id) {
        setResults([])
        setError(requestError.message || 'Search could not be completed. Try again.')
      }
    } finally {
      if (requestId.current === id) setLoading(false)
    }
  }

  function changeMode(nextMode) {
    if (nextMode === mode) return
    requestId.current += 1
    setMode(nextMode)
    setResults([])
    setSubmitted(false)
    setLoading(false)
    setError('')
  }

  return (
    <section className="taste-search-panel" aria-label="Find music">
      <form className="taste-search-form" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="taste-search-input">Search {mode === 'album' ? 'albums' : 'songs'}</label>
        <input id="taste-search-input" ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search music" autoComplete="off" />
        {query && <button type="button" className="taste-search-clear" aria-label="Clear search" onClick={() => { setQuery(''); setResults([]); setSubmitted(false); setError(''); inputRef.current?.focus() }}>×</button>}
        <button className="taste-search-submit" type="submit" aria-label={`Search ${mode === 'album' ? 'albums' : 'songs'}`} disabled={!query.trim()}><SearchIcon /></button>
      </form>
      <div className="taste-search-modes" role="group" aria-label="Search type">
        <button type="button" className={mode === 'album' ? 'is-active' : ''} aria-pressed={mode === 'album'} onClick={() => changeMode('album')}>Albums</button>
        <button type="button" className={mode === 'song' ? 'is-active' : ''} aria-pressed={mode === 'song'} onClick={() => changeMode('song')}>Songs</button>
      </div>
      <div className="taste-results" aria-live="polite" aria-busy={loading}>
        {loading && <p className="taste-search-message">Searching {mode === 'album' ? 'albums' : 'songs'}…</p>}
        {!loading && error && <p className="taste-search-message is-error" role="alert">{error}</p>}
        {!loading && !error && submitted && results.length === 0 && <p className="taste-search-message">No results</p>}
        {!loading && !error && !submitted && <p className="taste-search-message taste-search-hint">Search by album, song, or artist.</p>}
        {!loading && results.map((item, index) => <ResultCard key={identity(item) || `${item.title}-${index}`} item={item} draft={draft} ratings={ratings} options={options} onAdd={onAdd} />)}
      </div>
    </section>
  )
}

function TasteSlot({ item, section, index, onRemove, onDragStart, onDragOver, onDrop, dragging }) {
  const [loadedImage, setLoadedImage] = useState('')
  const [failedImage, setFailedImage] = useState('')
  const details = item ? itemDetails(item) : null
  const metadataLoading = Boolean(details?.metadataLoading)
  const titleIsMbid = Boolean(details?.mbid && details.title === details.mbid)
  const titleLoading = metadataLoading || (titleIsMbid && !details?.metadataLoaded)
  const title = titleLoading
    ? 'Loading…'
    : titleIsMbid
      ? `${section.kind === 'song' ? 'Song' : 'Album'} details unavailable`
      : details?.title || 'Music item'
  const imageLoading = Boolean(details?.image && loadedImage !== details.image && failedImage !== details.image)
  const showBuffering = metadataLoading || imageLoading
  return <div
    className={`taste-slot${item ? ' is-filled' : ''}${dragging ? ' is-dragging' : ''}`}
    onDragOver={onDragOver ? (event) => onDragOver(event, index) : undefined}
    onDrop={onDrop ? (event) => onDrop(event, index) : undefined}
  >
    {item ? <>
      <div className="taste-slot-art" draggable onDragStart={(event) => onDragStart(event, index)} onDragEnd={() => onDragStart(null, null)} aria-busy={showBuffering}>
        {details.image && <img className={imageLoading ? 'is-loading' : ''} src={details.image} alt={`${title} cover`} loading="lazy" onLoad={() => setLoadedImage(details.image)} onError={(event) => { setFailedImage(details.image); event.currentTarget.remove() }} />}
        {showBuffering && <span className="taste-buffering" role="status" aria-label={`Loading ${section.kind} details`} />}
        {!showBuffering && (!details.image || failedImage === details.image) && <span className="taste-art-fallback" aria-hidden="true">♫</span>}
        <button type="button" className="taste-remove-button" aria-label={`Remove ${title} from ${section.title}`} onClick={() => onRemove(section.key, index)}><span aria-hidden="true">×</span></button>
      </div>
      <span className="taste-slot-title" title={title}>{title}</span>
    </> : <div className="taste-slot-empty" aria-label={`Empty ${section.title} slot ${index + 1}`} />}
  </div>
}

function TasteSection({ section, items, onRemove, onReorder }) {
  const [draggingIndex, setDraggingIndex] = useState(null)

  function startDrag(event, index) {
    if (index == null) {
      setDraggingIndex(null)
      return
    }
    setDraggingIndex(index)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }

  function dropItem(event, toIndex) {
    event.preventDefault()
    const value = event.dataTransfer.getData('text/plain')
    const fromIndex = Number(value)
    setDraggingIndex(null)
    if (value !== '' && Number.isInteger(fromIndex) && fromIndex !== toIndex) onReorder(section.key, fromIndex, toIndex)
  }

  return <section className="taste-section" aria-labelledby={`taste-heading-${section.key}`}>
    <h2 id={`taste-heading-${section.key}`}>{section.title}</h2>
    <div className="taste-tray">
      {Array.from({ length: section.max }, (_, index) => <TasteSlot
        key={`${section.key}-${index}`}
        item={items[index]}
        section={section}
        index={index}
        itemCount={items.length}
        onRemove={onRemove}
        onDragStart={startDrag}
        onDragOver={(event) => event.preventDefault()}
        onDrop={dropItem}
        dragging={draggingIndex === index}
      />)}
    </div>
    {items.length > section.max && <p className="taste-overflow-note">Showing 3 of {items.length} saved songs. Remove a visible song to bring the next one into view.</p>}
  </section>
}

function ClearDialog({ onCancel, onConfirm }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  return <dialog className="taste-dialog" ref={dialogRef} aria-labelledby="taste-clear-title" aria-describedby="taste-clear-description" onCancel={(event) => { event.preventDefault(); onCancel() }}>
    <h2 id="taste-clear-title">Clear your taste lists?</h2>
    <p id="taste-clear-description">This empties the draft. Your saved lists change only after you select Save.</p>
    <div className="taste-dialog-actions"><button type="button" onClick={onCancel}>Keep lists</button><button type="button" className="is-danger" onClick={onConfirm}>Clear all</button></div>
  </dialog>
}

function LeaveDialog({ onStay, onLeave }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  return <dialog className="taste-dialog" ref={dialogRef} aria-labelledby="taste-leave-title" aria-describedby="taste-leave-description" onCancel={(event) => { event.preventDefault(); onStay() }}>
    <h2 id="taste-leave-title">Leave without saving?</h2>
    <p id="taste-leave-description">Your staged changes will be lost if you leave this page.</p>
    <div className="taste-dialog-actions"><button type="button" onClick={onStay}>Stay here</button><button type="button" className="is-danger" onClick={onLeave}>Leave page</button></div>
  </dialog>
}

async function replaceSection(section, currentItems, targetItems, token) {
  const currentIds = currentItems.map(identity)
  const targetIds = targetItems.map(identity)
  const targetSet = new Set(targetIds)
  const kept = currentItems.filter((item) => targetSet.has(identity(item)))
  const keptIds = kept.map(identity)
  const targetKeptIds = targetIds.filter((id) => currentIds.includes(id))
  const appendOnly = keptIds.every((id, index) => id === targetKeptIds[index])
    && targetIds.slice(0, keptIds.length).every((id, index) => id === keptIds[index])

  if (!appendOnly) {
    for (const item of currentItems) await removeTasteItem(item.id, token)
    for (const [index, item] of targetItems.entries()) await addTasteItem(section.key, item, index + 1, token)
    return
  }

  for (const item of currentItems) {
    if (!targetSet.has(identity(item))) await removeTasteItem(item.id, token)
  }
  const retainedTargets = targetItems.slice(0, keptIds.length)
  for (const [index, item] of retainedTargets.entries()) {
    const current = kept.find((entry) => identity(entry) === identity(item))
    if (current && Number(current.rank) !== index + 1) await updateTasteItem(current.id, { rank: index + 1 }, token)
  }
  for (const [index, item] of targetItems.entries()) {
    if (!currentIds.includes(identity(item))) await addTasteItem(section.key, item, index + 1, token)
  }
}

function TastePage() {
  const token = getStoredToken()
  const [saved, setSaved] = useState(emptyTaste)
  const [draft, setDraft] = useState(emptyTaste)
  const [username, setUsername] = useState('')
  const [ratings, setRatings] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [loadFailures, setLoadFailures] = useState({})
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveDestination, setLeaveDestination] = useState('')
  const allowNavigationRef = useRef(false)
  const clearAllRequestedRef = useRef(false)
  const dirty = !sameTaste(saved, draft)

  useEffect(() => {
    if (!token) {
      window.location.replace('/login')
      return undefined
    }
    let cancelled = false
    async function loadTaste() {
      try {
        const currentUser = await apiRequest('/users/me', { token })
        if (cancelled) return
        setUsername(currentUser.username)
        const enrichmentUpdates = {}
        const results = await Promise.allSettled(sections.map((section) => getMyTasteList(currentUser.username, section.key, token, (items) => {
      const enriched = items.map((item) => ({ ...itemDetails(item), mbid: item.mbid, id: item.id, rank: item.rank, liked: item.liked }))
      if (cancelled) return
      enrichmentUpdates[section.key] = enriched
      setSaved((current) => ({ ...current, [section.key]: enriched }))
      setDraft((current) => current[section.key].every((item) => items.some((entry) => identity(entry) === identity(item)))
        ? { ...current, [section.key]: current[section.key].map((item) => ({ ...item, ...(enriched.find((entry) => identity(entry) === identity(item)) || {}) })) }
        : current)
    })))
      if (cancelled) return
      const next = emptyTaste()
      const errors = []
      const failedCategories = {}
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const key = sections[index].key
          const initialItems = result.value.map((item, itemIndex) => ({ ...itemDetails(item), mbid: item.mbid || item.recording_mbid, id: item.id, rank: Number(item.rank) || itemIndex + 1, liked: Boolean(item.liked) }))
          const enrichedItems = enrichmentUpdates[key] || []
          next[key] = initialItems.map((item) => ({ ...item, ...(enrichedItems.find((enriched) => identity(enriched) === identity(item)) || {}) }))
            .sort((a, b) => a.rank - b.rank)
            .slice(0, key === 'rotation_song' ? 6 : sections[index].max)
        }
        else {
          failedCategories[sections[index].key] = result.reason?.message || 'request failed'
          errors.push(`${sections[index].title}: ${failedCategories[sections[index].key]}`)
        }
      })
      setSaved(next)
      setDraft(cloneTaste(next))
      setLoadFailures(failedCategories)
      if (errors.length) setLoadError(`Could not load some lists. Save will retry each affected list before writing. ${errors.join(' · ')}`)
      } catch (error) {
        if (!cancelled && /401|unauthorized|unauthenticated|not authenticated|credentials/i.test(error.message || '')) {
          clearStoredToken()
          window.location.replace('/login')
        } else if (!cancelled) setLoadError(error.message || 'Your taste lists could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadTaste()
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    async function loadRatings() {
      try {
        const user = await apiRequest('/users/me', { token })
        const reviews = await getUserReviews(user.username, token).catch((error) => {
          if (isEmptyResponse(error)) return []
          throw error
        })
        const next = Object.fromEntries(reviews.flatMap((review) => {
          const mbid = review.mbid || review.album_mbid || review.album?.mbid
          const rating = Number(review.rating)
          return mbid && Number.isFinite(rating) ? [[mbid, rating]] : []
        }))
        if (!cancelled) setRatings(next)
      } catch { /* Taste editing remains available when review ratings cannot be read. */ }
    }
    loadRatings()
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    function beforeUnload(event) {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    function guardLinks(event) {
      if (!dirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target.closest?.('a[href]')
      if (!link || link.target || link.hasAttribute('download')) return
      const destination = new URL(link.href, window.location.href)
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return
      event.preventDefault()
      event.stopPropagation()
      setLeaveDestination(`${destination.pathname}${destination.search}${destination.hash}`)
      setLeaveOpen(true)
    }
    function guardBackNavigation(event) {
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false
        return
      }
      if (!dirty) return
      event.stopImmediatePropagation()
      const destination = `${window.location.pathname}${window.location.search}${window.location.hash}`
      window.history.pushState({}, '', '/taste')
      setLeaveDestination(destination)
      setLeaveOpen(true)
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', guardLinks, true)
    window.addEventListener('popstate', guardBackNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', guardLinks, true)
      window.removeEventListener('popstate', guardBackNavigation, true)
    }
  }, [dirty])

  function addItem(category, item) {
    setNotice('')
    setDraft((current) => current[category].length >= sections.find(({ key }) => key === category).max
      || current[category].some((entry) => identity(entry) === identity(item))
      ? current
      : { ...current, [category]: [...current[category], { ...item, rank: current[category].length + 1, liked: false }] })
  }

  function removeItem(category, index) {
    setDraft((current) => ({ ...current, [category]: current[category].filter((_, itemIndex) => itemIndex !== index).map((item, rank) => ({ ...item, rank: rank + 1 })) }))
    setNotice('')
  }

  function reorderItem(category, fromIndex, toIndex) {
    setDraft((current) => {
      const items = [...current[category]]
      if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= sections.find(({ key }) => key === category).max) return current
      const [item] = items.splice(fromIndex, 1)
      items.splice(Math.min(toIndex, items.length), 0, item)
      return { ...current, [category]: items.map((entry, index) => ({ ...entry, rank: index + 1 })) }
    })
    setNotice('')
  }

  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    setSaveError('')
    setNotice('')
    const failed = []
    const remainingLoadFailures = { ...loadFailures }
    for (const section of sections) {
      let currentItems = saved[section.key]
      let targetItems = draft[section.key]
      try {
        if (loadFailures[section.key]) {
          currentItems = await getMyTasteList(username, section.key, token)
          targetItems = clearAllRequestedRef.current
            ? draft[section.key]
            : [...currentItems, ...draft[section.key].filter((item) => !currentItems.some((entry) => identity(entry) === identity(item)))]
          setDraft((current) => ({ ...current, [section.key]: targetItems }))
          setSaved((current) => ({ ...current, [section.key]: currentItems }))
          delete remainingLoadFailures[section.key]
        }
        if (sameTaste({ [section.key]: currentItems }, { [section.key]: targetItems })) continue
        await replaceSection(section, currentItems, targetItems, token)
        const fresh = await getMyTasteList(username, section.key, token)
        const normalized = fresh.map((item, index) => ({ ...itemDetails(item), mbid: item.mbid || item.recording_mbid, id: item.id, rank: Number(item.rank) || index + 1, liked: Boolean(item.liked) })).sort((a, b) => a.rank - b.rank)
        setSaved((current) => ({ ...current, [section.key]: normalized }))
      } catch (error) {
        failed.push(`${section.title}: ${error.message || 'save failed'}`)
        try {
          const fresh = await getMyTasteList(username, section.key, token)
          const normalized = fresh.map((item, index) => ({ ...itemDetails(item), mbid: item.mbid || item.recording_mbid, id: item.id, rank: Number(item.rank) || index + 1, liked: Boolean(item.liked) })).sort((a, b) => a.rank - b.rank)
          setSaved((current) => ({ ...current, [section.key]: normalized }))
          delete remainingLoadFailures[section.key]
        } catch { /* keep the last known baseline when refresh is unavailable */ }
      }
    }
    setLoadFailures(remainingLoadFailures)
    if (failed.length) setSaveError(`Some changes did not save. ${failed.join(' · ')}. Your draft is still here.`)
    else {
      setNotice('Taste saved.')
      const unresolved = Object.entries(remainingLoadFailures).map(([key, message]) => `${sections.find((section) => section.key === key)?.title}: ${message}`)
      setLoadError(unresolved.length ? `Could not load some lists. ${unresolved.join(' · ')}` : '')
      clearAllRequestedRef.current = false
    }
    setSaving(false)
  }

  function confirmLeave() {
    setLeaveOpen(false)
    if (leaveDestination) {
      allowNavigationRef.current = true
      window.history.pushState({}, '', leaveDestination)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  if (!token) return null
  return <main className="taste-page">
    <AppHeader />
    <div className="taste-workspace" aria-busy={loading}>
      <SearchPanel token={token} draft={draft} ratings={ratings} onAdd={addItem} />
      <section className="taste-editor-panel" aria-label="Current taste">
        {loading && <p className="taste-loading" role="status">Loading your taste…</p>}
        {loadError && <p className="taste-inline-error" role="alert">{loadError}</p>}
        {!loading && sections.map((section) => <TasteSection key={section.key} section={section} items={draft[section.key]} onRemove={removeItem} onReorder={reorderItem} />)}
        <div className="taste-actions">
          <button type="button" className="taste-clear-button" disabled={loading || saving || (!dirty && !sections.some(({ key }) => draft[key].length))} onClick={() => setClearOpen(true)}>Clear all</button>
          <button type="button" className="taste-save-button" disabled={loading || saving || !dirty} onClick={save} aria-busy={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
        {saveError && <p className="taste-inline-error" role="alert">{saveError}</p>}
        {notice && <p className="taste-success" role="status">{notice}</p>}
      </section>
    </div>
    {clearOpen && <ClearDialog onCancel={() => setClearOpen(false)} onConfirm={() => { clearAllRequestedRef.current = true; setDraft(emptyTaste()); setClearOpen(false); setNotice(''); setSaveError('') }} />}
    {leaveOpen && <LeaveDialog onStay={() => setLeaveOpen(false)} onLeave={confirmLeave} />}
  </main>
}

export default TastePage
