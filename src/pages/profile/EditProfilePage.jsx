import { useEffect, useRef, useState } from 'react'
import AppHeader from '../../components/layout/AppHeader.jsx'
import { apiRequest, clearStoredToken, getMyTasteList, getStoredToken, normalizeArtworkUrl, searchAlbums, searchArtists } from '../../api/api.js'
import { GENRES } from '../../data/genreOptions.js'
import './EditProfilePage.css'

const blank = { name: '', username: '', bio: '', pfp_link: '' }
const idOf = (item) => item.mbid || item.id
const copyItems = (items) => items.map((item) => ({ ...item }))
const sameRankedItems = (left, right) => left.length === right.length
  && left.every((item, index) => idOf(item) === idOf(right[index]))

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.2" /><path d="m16.2 16.2 5 5" /></svg>
}

function RankedList({ title, items, onRemove, onReorder, className = '' }) {
  const dragIndex = useRef(null)
  const touchDrag = useRef(null)

  function startTouchDrag(event, index) {
    if (event.pointerType !== 'touch' || event.target.closest('button')) return
    event.preventDefault()
    const rowElement = event.currentTarget
    const state = { from: index, to: index, active: false, timer: null }
    state.timer = window.setTimeout(() => { state.active = true; rowElement.classList.add('is-touch-dragging') }, 180)
    touchDrag.current = state
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveTouchDrag(event) {
    const state = touchDrag.current
    if (!state?.active) return
    event.preventDefault()
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest('.edit-ranked-row[data-rank-index]')
    if (row) state.to = Number(row.dataset.rankIndex)
  }

  function endTouchDrag(event) {
    const state = touchDrag.current
    if (!state) return
    window.clearTimeout(state.timer)
    event.currentTarget.classList.remove('is-touch-dragging')
    touchDrag.current = null
    if (state.active && state.from !== state.to) onReorder(state.from, state.to)
  }

  return <div className={`edit-ranked-list ${className}`.trim()} aria-label={title}>
    {items.map((item, index) => <div className="edit-ranked-row" data-rank-index={index} key={`${idOf(item) || item.title}-${index}`} draggable onPointerDown={(event) => startTouchDrag(event, index)} onPointerMove={moveTouchDrag} onPointerUp={endTouchDrag} onPointerCancel={endTouchDrag} onDragStart={(event) => { dragIndex.current = index; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)) }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) onReorder(from, index) }} onDragEnd={() => { dragIndex.current = null }}>
      <span className="edit-rank-number">{index + 1}</span><span className="edit-rank-title" title={item.title}>{item.title}</span>
      <button className="edit-remove" type="button" aria-label={`Remove ${item.title}`} onClick={() => onRemove(index)}>{className.includes('mobile-ranked-list') ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h13l4 7-4 7H4z" /><path d="m9 9 5 6m0-6-5 6" /></svg> : '×'}</button>
    </div>)}
    {!items.length && <p className="edit-empty-list">Choose up to three {title.toLowerCase()}.</p>}
  </div>
}

function MobileProfileEditor({
  screen, hasChanges, saving, loaded, loadError, saveError, notice, profile, setProfile,
  genres, setGenres, artists, setArtists, discard, openScreen, reorder, searchAlbums,
  searchArtists, searchState, onAlbumQueryChange, clearAlbumQuery, onArtistQueryChange, clearArtistQuery,
  mobileGenres, setMobileGenres, mobileArtists, setMobileArtists,
  mobilePicture, setMobilePicture, mobileSelectedArtwork, setMobileSelectedArtwork, closeScreen,
}) {
  const mainTitleRef = useRef(null)
  const subpageTitleRef = useRef(null)
  const previousScreen = useRef(screen)
  const {
    query, results, searching, searchError, searched, artistQuery, artistResults,
    artistSearching, artistError, artistSearched,
  } = searchState

  useEffect(() => {
    if (previousScreen.current === screen) return
    previousScreen.current = screen
    if (screen === 'main') mainTitleRef.current?.focus()
    else subpageTitleRef.current?.focus()
  }, [screen])

  useEffect(() => {
    if (screen === 'main') return undefined
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeScreen()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [screen, closeScreen])

  function applyScreenDraft() {
    if (screen === 'artwork') setProfile((current) => ({ ...current, pfp_link: mobilePicture }))
    if (screen === 'artists') setArtists(copyItems(mobileArtists))
    if (screen === 'genres') setGenres(copyItems(mobileGenres))
    closeScreen()
  }

  return <div className="edit-profile-mobile-view" data-screen={screen}>
    <div className={`mobile-edit-save-prompt${hasChanges && screen === 'main' ? ' is-open' : ''}`} aria-hidden={!hasChanges || screen !== 'main'}>
      <button className="mobile-edit-save" type="submit" disabled={!loaded || saving || Boolean(loadError)}>{saving ? 'Saving…' : 'Save changes'}</button>
      <button className="mobile-edit-discard" type="button" onClick={discard} disabled={saving}>Discard</button>
    </div>

    {screen === 'main' && <div className="mobile-profile-edit-main">
      <section className="mobile-profile-picture-section">
        <h1 ref={mainTitleRef} tabIndex={-1}>Profile picture</h1>
        <div className="mobile-profile-picture-controls">
          <img src={normalizeArtworkUrl(profile.pfp_link) || '/images/profile-default.png'} alt="Profile picture preview" onError={(event) => { event.currentTarget.src = '/images/profile-default.png' }} />
          <button type="button" className="mobile-profile-picture-search" onClick={() => openScreen('artwork')}>
            <span>Search album art.</span><SearchIcon />
          </button>
        </div>
      </section>
      <div className="mobile-profile-field"><label htmlFor="mobile-edit-name">Name</label><input id="mobile-edit-name" value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} autoComplete="name" /></div>
      <div className="mobile-profile-field"><label htmlFor="mobile-edit-username">Username</label><input id="mobile-edit-username" value={profile.username} onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))} autoComplete="username" /></div>
      <div className="mobile-profile-field mobile-profile-bio"><label htmlFor="mobile-edit-bio">Bio</label><textarea id="mobile-edit-bio" maxLength={100} value={profile.bio} onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))} /><small>{profile.bio.length}/100</small></div>
      <section className="mobile-profile-ranked-summary">
        <h2>Top Genres</h2>
        <div className="mobile-summary-rank-list" aria-label="Top genres">
          {genres.map((item, index) => <div className="mobile-summary-rank" key={`${idOf(item)}-${index}`}><span>{index + 1}</span><span>{item.title}</span></div>)}
          {!genres.length && <p>No genres selected</p>}
        </div>
        <button type="button" className="mobile-summary-edit" onClick={() => openScreen('genres')}>Edit</button>
      </section>
      <section className="mobile-profile-ranked-summary">
        <h2>Top Artists</h2>
        <div className="mobile-summary-rank-list" aria-label="Top artists">
          {artists.map((item, index) => <div className="mobile-summary-rank" key={`${idOf(item)}-${index}`}><span>{index + 1}</span><span>{item.title}</span></div>)}
          {!artists.length && <p>No artists selected</p>}
        </div>
        <button type="button" className="mobile-summary-edit" onClick={() => openScreen('artists')}>Edit</button>
      </section>
      {(loadError || saveError) && <p className="mobile-profile-error" role="alert">{loadError || saveError}</p>}
      {notice && <p className="mobile-profile-notice" role="status">{notice}</p>}
    </div>}

    {screen !== 'main' && <section className={`mobile-profile-subpage mobile-profile-subpage-${screen}`} aria-label={`Edit ${screen === 'artwork' ? 'profile picture' : screen}`}>
      <header className="mobile-profile-subpage-header">
          <h1 ref={subpageTitleRef} tabIndex={-1}>{screen === 'artwork' ? 'Edit profile picture' : screen === 'artists' ? 'Edit artists' : 'Edit genres'}</h1>
        <div className="mobile-profile-subpage-actions">
          <button type="button" className="mobile-subpage-cancel" aria-label="Discard changes" onClick={closeScreen}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg></button>
          <button type="button" className="mobile-subpage-apply" aria-label="Apply changes" onClick={applyScreenDraft}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 5.2 5L20 6" /></svg></button>
        </div>
      </header>

      {screen === 'artwork' && <div className="mobile-profile-artwork-editor">
        <div className="mobile-subpage-search">
          <input aria-label="Search album art" value={query} onChange={(event) => onAlbumQueryChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') searchAlbums(event, 'album') }} placeholder="Search album art." />
          <button type="button" aria-label="Search album art" disabled={!query.trim() || searching} onClick={() => searchAlbums(null, 'album')}><SearchIcon /></button>
          {query && <button type="button" className="mobile-subpage-clear" aria-label="Clear search" onClick={clearAlbumQuery}>×</button>}
        </div>
        <div className="mobile-subpage-results" aria-live="polite" aria-busy={searching}>
          {searching && <p className="mobile-subpage-state">Searching…</p>}
          {!searching && searchError && <p className="mobile-subpage-state is-error" role="alert">{searchError}</p>}
          {!searching && searched && !searchError && !results.length && <p className="mobile-subpage-state">No albums found.</p>}
          {!searching && results.map((item) => <button type="button" className={`mobile-artwork-result${mobileSelectedArtwork?.mbid === item.mbid ? ' is-selected' : ''}`} key={idOf(item)} onClick={() => { setMobilePicture(item.image || ''); setMobileSelectedArtwork(item) }}>
            <img src={item.image || '/images/profile-default.png'} alt="" onError={(event) => { event.currentTarget.src = '/images/profile-default.png' }} />
            <span><strong>{item.title}</strong><small>{item.artist}</small></span>
            {mobileSelectedArtwork?.mbid === item.mbid && <span className="mobile-artwork-selected" aria-label="Selected">✓</span>}
          </button>)}
        </div>
      </div>}

      {screen === 'artists' && <div className="mobile-profile-ranked-editor">
        <RankedList title="Top artists" items={mobileArtists} className="mobile-ranked-list" onRemove={(index) => setMobileArtists((items) => items.filter((_, itemIndex) => itemIndex !== index))} onReorder={(from, to) => reorder(setMobileArtists, mobileArtists, from, to)} />
        <div className="mobile-subpage-search mobile-artist-search">
          <input aria-label="Search artists" value={artistQuery} onChange={(event) => onArtistQueryChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') searchArtists(event) }} placeholder="Search artists." />
          <button type="button" aria-label="Search artists" disabled={!artistQuery.trim() || artistSearching} onClick={() => searchArtists(null)}><SearchIcon /></button>
          {artistQuery && <button type="button" className="mobile-subpage-clear" aria-label="Clear search" onClick={clearArtistQuery}>×</button>}
        </div>
        <div className="mobile-subpage-results mobile-artist-results" aria-live="polite" aria-busy={artistSearching}>
          {artistSearching && <p className="mobile-subpage-state">Searching…</p>}
          {!artistSearching && artistError && <p className="mobile-subpage-state is-error" role="alert">{artistError}</p>}
          {!artistSearching && artistSearched && !artistError && !artistResults.length && <p className="mobile-subpage-state">No artists found.</p>}
          {artistResults.map((item) => <button type="button" key={idOf(item)} disabled={mobileArtists.length >= 3 || mobileArtists.some((entry) => idOf(entry) === idOf(item))} onClick={() => setMobileArtists((items) => [...items, { ...item, category: 'top_artists' }])}>{item.title}</button>)}
        </div>
      </div>}

      {screen === 'genres' && <div className="mobile-profile-ranked-editor mobile-genre-editor">
        <RankedList title="Top genres" items={mobileGenres} className="mobile-ranked-list" onRemove={(index) => setMobileGenres((items) => items.filter((_, itemIndex) => itemIndex !== index))} onReorder={(from, to) => reorder(setMobileGenres, mobileGenres, from, to)} />
        <h2>Select</h2>
        <div className="mobile-genre-options" aria-label="Available genres">
          {GENRES.filter((genre) => !mobileGenres.some((item) => item.title === genre)).map((genre) => <button type="button" key={genre} disabled={mobileGenres.length >= 3} onClick={() => setMobileGenres((items) => [...items, { title: genre, mbid: genre, category: 'top_genres' }])}>{genre}</button>)}
        </div>
      </div>}
    </section>}
  </div>
}

function EditProfilePage({ embedded = false }) {
  const token = getStoredToken()
  const [profile, setProfile] = useState(blank)
  const [genres, setGenres] = useState([])
  const [artists, setArtists] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searched, setSearched] = useState(false)
  const [genreMenu, setGenreMenu] = useState(false)
  const [artistQuery, setArtistQuery] = useState('')
  const [artistResults, setArtistResults] = useState([])
  const [artistSearching, setArtistSearching] = useState(false)
  const [artistError, setArtistError] = useState('')
  const [artistSearched, setArtistSearched] = useState(false)
  const [mobileScreen, setMobileScreen] = useState('main')
  const [mobileGenres, setMobileGenres] = useState([])
  const [mobileArtists, setMobileArtists] = useState([])
  const [mobilePicture, setMobilePicture] = useState('')
  const [mobileSelectedArtwork, setMobileSelectedArtwork] = useState(null)
  const [baselineProfile, setBaselineProfile] = useState({ ...blank })
  const [baselineGenres, setBaselineGenres] = useState([])
  const [baselineArtists, setBaselineArtists] = useState([])
  const request = useRef(0)
  const artistRequest = useRef(0)
  const initialGenres = useRef([])
  const initialArtists = useRef([])
  const initialProfile = useRef({ ...blank })
  const artistMetadata = useRef(new Map())

  function applyArtistMetadata(enrichedItems) {
    for (const item of enrichedItems) {
      const mbid = idOf(item)
      const title = item.title || item.name || item.artist
      if (mbid && title && title !== mbid) artistMetadata.current.set(mbid, title)
    }
    const withNames = (items) => items.map((item) => ({
      ...item,
      title: artistMetadata.current.get(idOf(item)) || item.title || item.name || item.artist || item.mbid,
    }))
    initialArtists.current = withNames(initialArtists.current)
    setArtists((current) => withNames(current))
  }

  useEffect(() => {
    if (!token) { window.location.replace('/login'); return undefined }
    let cancelled = false
    async function load() {
      try {
        const user = await apiRequest('/users/me', { token })
        const [genreResult, artistResult] = await Promise.allSettled([
          getMyTasteList(user.username, 'top_genres', token),
          getMyTasteList(user.username, 'top_artists', token, (items) => {
            if (!cancelled) applyArtistMetadata(items)
          }),
        ])
        if (cancelled) return
        if (genreResult.status === 'rejected' || artistResult.status === 'rejected') throw new Error('Your ranked genres or artists could not be loaded. Reload the page before saving.')
        const loadedProfile = { name: user.name || '', username: user.username || '', bio: user.bio || '', pfp_link: user.pfp_link || '' }
        setProfile(loadedProfile)
        initialProfile.current = { ...loadedProfile }
        setBaselineProfile({ ...loadedProfile })
        const rankedGenres = genreResult.value.sort((a, b) => Number(a.rank) - Number(b.rank)).map((item) => ({ ...item, title: item.title || item.name || item.genre || item.mbid }))
        const initialGenreList = rankedGenres.length ? rankedGenres : (user.fav_genres || []).slice(0, 3).map((genre) => ({ title: genre, mbid: genre, category: 'top_genres' }))
        const initialArtistList = artistResult.value.sort((a, b) => Number(a.rank) - Number(b.rank)).map((item) => ({
          ...item,
          title: artistMetadata.current.get(idOf(item)) || item.title || item.name || item.artist || item.mbid,
        }))
        initialGenres.current = initialGenreList.map((item) => ({ ...item }))
        initialArtists.current = initialArtistList.map((item) => ({ ...item }))
        setBaselineGenres(copyItems(initialGenreList))
        setBaselineArtists(copyItems(initialArtistList))
        setGenres(initialGenreList)
        setArtists(initialArtistList)
        setLoaded(true)
      } catch (error) {
        if (cancelled) return
        if (/401|unauthorized|unauthenticated|credentials/i.test(error.message || '')) { clearStoredToken(); window.location.replace('/login'); return }
        setLoadError(error.message || 'Profile could not be loaded.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  async function search(event, kind = 'album') {
    event?.preventDefault()
    if (!query.trim()) return
    const id = ++request.current
    setSearching(true); setSearchError(''); setSearched(true)
    try {
      const found = kind === 'album' ? await searchAlbums(query.trim(), token, 6) : await searchArtists(query.trim(), 6)
      if (id === request.current) setResults(found)
    } catch (error) {
      if (id === request.current) { setResults([]); setSearchError(error.message || 'Search failed. Try again.') }
    } finally { if (id === request.current) setSearching(false) }
  }

  async function searchForArtist(event) {
    event?.preventDefault()
    if (!artistQuery.trim()) return
    const id = ++artistRequest.current
    setArtistSearching(true); setArtistError(''); setArtistSearched(true)
    try {
      const found = await searchArtists(artistQuery.trim(), 6)
      if (id === artistRequest.current) setArtistResults(found)
    } catch (error) { if (id === artistRequest.current) { setArtistResults([]); setArtistError(error.message || 'Artist search failed.') } }
    finally { if (id === artistRequest.current) setArtistSearching(false) }
  }

  function addGenre(genre) {
    if (genres.length >= 3 || genres.some((entry) => entry.title === genre)) return
    setGenres((current) => [...current, { title: genre, mbid: genre, category: 'top_genres' }]); setGenreMenu(false)
  }
  function addArtist(item) {
    if (artists.length >= 3 || artists.some((entry) => idOf(entry) === idOf(item))) return
    setArtists((current) => [...current, { ...item, category: 'top_artists' }]); setArtistQuery(''); setArtistResults([])
  }

  function openMobileScreen(screen) {
    request.current += 1
    artistRequest.current += 1
    setMobileScreen(screen)
    setSaveError('')
    setNotice('')
    if (screen === 'genres') setMobileGenres(copyItems(genres))
    if (screen === 'artists') setMobileArtists(copyItems(artists))
    if (screen === 'artwork') {
      setMobilePicture(profile.pfp_link || '')
      setMobileSelectedArtwork(profile.pfp_link ? { title: 'Current profile picture', image: profile.pfp_link } : null)
      setQuery('')
      setResults([])
      setSearching(false)
      setSearchError('')
      setSearched(false)
    }
  }

  function closeMobileScreen() {
    request.current += 1
    artistRequest.current += 1
    setMobileScreen('main')
    setQuery('')
    setResults([])
    setSearched(false)
    setSearchError('')
    setArtistQuery('')
    setArtistResults([])
    setArtistSearched(false)
    setArtistError('')
  }

  function changeMobileAlbumQuery(value) {
    request.current += 1
    setSearching(false)
    setQuery(value)
    setSearched(false)
    setResults([])
    setSearchError('')
  }

  function clearMobileAlbumQuery() { changeMobileAlbumQuery('') }

  function changeMobileArtistQuery(value) {
    artistRequest.current += 1
    setArtistSearching(false)
    setArtistQuery(value)
    setArtistSearched(false)
    setArtistResults([])
    setArtistError('')
  }

  function clearMobileArtistQuery() { changeMobileArtistQuery('') }

  function discardMobileChanges() {
    setProfile({ ...initialProfile.current })
    setGenres(copyItems(initialGenres.current))
    setArtists(copyItems(initialArtists.current))
    closeMobileScreen()
    setSaveError('')
    setNotice('')
  }
  function reorder(setItems, items, from, to) {
    if (from === to || from < 0 || from >= items.length) return
    setItems((current) => { const next = [...current]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next })
  }

  async function replaceRanked(category, before, after) {
    if (before.length === after.length && before.every((item, index) => item.id != null && idOf(item) === idOf(after[index]))) return
    for (const item of before) if (item.id != null) await apiRequest(`/users/me/taste/${encodeURIComponent(item.id)}`, { method: 'DELETE', token })
    for (const [index, item] of after.entries()) {
      const mbid = item.mbid || item.id || item.title
      await apiRequest(`/users/me/taste?category=${category}`, { method: 'POST', token, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mbid, rank: index + 1, liked: false }) })
    }
  }

  async function save(event) {
    event.preventDefault(); if (saving || !loaded) return
    if (!genres.length) { setSaveError('Choose at least one genre before saving.'); return }
    if (!profile.name.trim() || !profile.username.trim()) { setSaveError('Name and username are required.'); return }
    setSaving(true); setSaveError(''); setNotice('')
    try {
      const savedProfile = { ...profile, name: profile.name.trim(), username: profile.username.trim(), bio: profile.bio.trim() }
      await apiRequest('/users/me', { method: 'PATCH', token, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...savedProfile, bio: savedProfile.bio || null, pfp_link: savedProfile.pfp_link || null, fav_genres: genres.map((item) => item.title) }) })
      await replaceRanked('top_genres', initialGenres.current, genres)
      await replaceRanked('top_artists', initialArtists.current, artists)
      const [freshGenres, freshArtists] = await Promise.all([
        getMyTasteList(savedProfile.username, 'top_genres', token),
        getMyTasteList(savedProfile.username, 'top_artists', token, applyArtistMetadata),
      ])
      const normalizedGenres = freshGenres.sort((a, b) => Number(a.rank) - Number(b.rank)).map((item) => ({ ...item, title: item.title || item.name || item.genre || item.mbid }))
      const normalizedArtists = freshArtists.sort((a, b) => Number(a.rank) - Number(b.rank)).map((item) => ({
        ...item,
        title: artistMetadata.current.get(idOf(item)) || item.title || item.name || item.artist || item.mbid,
      }))
      setProfile(savedProfile)
      setGenres(normalizedGenres); setArtists(normalizedArtists)
      initialProfile.current = { ...savedProfile }
      initialGenres.current = copyItems(normalizedGenres)
      initialArtists.current = copyItems(normalizedArtists)
      setBaselineProfile({ ...savedProfile })
      setBaselineGenres(copyItems(normalizedGenres))
      setBaselineArtists(copyItems(normalizedArtists))
      setNotice('Profile saved.')
    } catch (error) { setSaveError(error.message || 'Some changes could not be saved. Review your entries and try again.') }
    finally { setSaving(false) }
  }

  if (!token) return null
  const hasMobileChanges = loaded && (
    Object.keys(baselineProfile).some((field) => (profile[field] || '') !== (baselineProfile[field] || ''))
    || !sameRankedItems(genres, baselineGenres)
    || !sameRankedItems(artists, baselineArtists)
  )
  const form = <form className={`edit-profile-board${embedded ? ' settings-editor-board' : ''}`} onSubmit={save} noValidate>
    <div className="edit-profile-desktop-view">
      <section className="edit-pfp-row">
        <h1>Profile picture</h1>
        <img className="edit-pfp-preview" src={normalizeArtworkUrl(profile.pfp_link) || '/images/profile-default.png'} alt="Profile picture preview" onError={(event) => { event.currentTarget.src = '/images/profile-default.png' }} />
        <div className="edit-search-wrap">
          <div className="edit-search-form">
            <input aria-label="Search album art" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') search(event, 'album') }} placeholder="Search album art." />
            <button type="button" aria-label="Search albums" disabled={!query.trim()} onClick={() => search(null, 'album')}><SearchIcon /></button>
          </div>
          {(query.trim() || searched) && <div className="edit-search-popover" aria-live="polite" aria-busy={searching}>
            {searching && <p className="edit-search-state">Searching…</p>}{searchError && <p className="edit-search-state is-error" role="alert">{searchError}</p>}
            {!searching && searched && !searchError && results.length === 0 && <p className="edit-search-state">No albums found.</p>}
            {!searching && results.map((item) => <button type="button" className="edit-album-result" key={idOf(item)} onClick={() => { setProfile((current) => ({ ...current, pfp_link: item.image || '' })); setResults([]); setQuery(''); setSearched(false) }}>
              <img src={item.image} alt="" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} /><span><strong>{item.title}</strong><small>{item.artist}</small></span>
            </button>)}
          </div>}
        </div>
      </section>
      <div className="edit-field-row"><label htmlFor="edit-name">Name</label><input id="edit-name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></div>
      <div className="edit-field-row edit-bio-row"><label htmlFor="edit-bio">Bio</label><textarea id="edit-bio" maxLength={100} value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} /><small>{profile.bio.length}/100</small></div>
      <section className="edit-ranked-section"><h2>Top Genres</h2><div className="edit-ranked-controls"><RankedList title="Top genres" items={genres} onRemove={(index) => setGenres((items) => items.filter((_, i) => i !== index))} onReorder={(from, to) => reorder(setGenres, genres, from, to)} /><button className="edit-picker-button" type="button" onClick={() => setGenreMenu((open) => !open)} aria-expanded={genreMenu}>Select Genres</button>
        {genreMenu && <div className="edit-genre-menu" role="group" aria-label="Available genres">{GENRES.filter((genre) => !genres.some((entry) => entry.title === genre)).map((genre) => <button type="button" key={genre} disabled={genres.length >= 3} onClick={() => addGenre(genre)}>{genre}</button>)}</div>}
      </div></section>
      <section className="edit-ranked-section"><h2>Top Artists</h2><div className="edit-ranked-controls"><RankedList title="Top artists" items={artists} onRemove={(index) => setArtists((items) => items.filter((_, i) => i !== index))} onReorder={(from, to) => reorder(setArtists, artists, from, to)} />
        <div className="edit-artist-search-wrap">
          <div className="edit-artist-search"><input aria-label="Search artists" value={artistQuery} onChange={(event) => { artistRequest.current += 1; setArtistSearching(false); setArtistQuery(event.target.value); setArtistSearched(false); setArtistResults([]) }} onKeyDown={(event) => { if (event.key === 'Enter') searchForArtist(event) }} placeholder="Search Artists" /><button type="button" aria-label="Search artists" disabled={!artistQuery.trim() || artistSearching} onClick={() => searchForArtist(null)}><SearchIcon /></button></div>
          {artistSearched && <div className="edit-artist-results" aria-live="polite" aria-busy={artistSearching}>{artistSearching && <p>Searching…</p>}{artistError && <p role="alert">{artistError}</p>}{!artistSearching && !artistError && !artistResults.length && <p>No artists found.</p>}{artistResults.map((item) => <button type="button" key={idOf(item)} disabled={artists.length >= 3 || artists.some((entry) => idOf(entry) === idOf(item))} onClick={() => { addArtist(item); setArtistSearched(false) }}>{item.title}</button>)}</div>}
        </div>
      </div></section>
      <div className="edit-profile-actions"><span role={notice ? 'status' : undefined}>{notice}</span><button type="submit" disabled={!loaded || saving || Boolean(loadError)}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      {loadError && <p className="edit-error" role="alert">{loadError}</p>}{saveError && <p className="edit-error" role="alert">{saveError}</p>}
    </div>
    <MobileProfileEditor
      screen={mobileScreen}
      hasChanges={hasMobileChanges}
      saving={saving}
      loaded={loaded}
      loadError={loadError}
      saveError={saveError}
      notice={notice}
      profile={profile}
      setProfile={setProfile}
      genres={genres}
      setGenres={setGenres}
      artists={artists}
      setArtists={setArtists}
      discard={discardMobileChanges}
      openScreen={openMobileScreen}
      reorder={reorder}
      searchAlbums={search}
      searchArtists={searchForArtist}
      onAlbumQueryChange={changeMobileAlbumQuery}
      clearAlbumQuery={clearMobileAlbumQuery}
      onArtistQueryChange={changeMobileArtistQuery}
      clearArtistQuery={clearMobileArtistQuery}
      searchState={{ query, results, searching, searchError, searched, artistQuery, artistResults, artistSearching, artistError, artistSearched }}
      mobileGenres={mobileGenres}
      setMobileGenres={setMobileGenres}
      mobileArtists={mobileArtists}
      setMobileArtists={setMobileArtists}
      mobilePicture={mobilePicture}
      setMobilePicture={setMobilePicture}
      mobileSelectedArtwork={mobileSelectedArtwork}
      setMobileSelectedArtwork={setMobileSelectedArtwork}
      closeScreen={closeMobileScreen}
    />
    </form>
  return embedded ? form : <main className="edit-profile-page">
    <AppHeader hideMobileNavigation />
    {form}
  </main>
}

export default EditProfilePage
