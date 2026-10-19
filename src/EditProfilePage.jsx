import { useEffect, useRef, useState } from 'react'
import AppHeader from './AppHeader.jsx'
import { apiRequest, clearStoredToken, getMyTasteList, getStoredToken, searchAlbums, searchArtists } from './api.js'
import { GENRES } from './genreOptions.js'
import './EditProfilePage.css'

const blank = { name: '', username: '', bio: '', pfp_link: '' }
const idOf = (item) => item.mbid || item.id

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.2" /><path d="m16.2 16.2 5 5" /></svg>
}

function RankedList({ title, items, onRemove, onReorder }) {
  const dragIndex = useRef(null)
  return <div className="edit-ranked-list" aria-label={title}>
    {items.map((item, index) => <div className="edit-ranked-row" key={`${idOf(item) || item.title}-${index}`} draggable onDragStart={(event) => { dragIndex.current = index; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)) }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) onReorder(from, index) }} onDragEnd={() => { dragIndex.current = null }}>
      <span className="edit-rank-number">{index + 1}</span><span className="edit-rank-title" title={item.title}>{item.title}</span>
      <button className="edit-remove" type="button" aria-label={`Remove ${item.title}`} onClick={() => onRemove(index)}>×</button>
    </div>)}
    {!items.length && <p className="edit-empty-list">Choose up to three {title.toLowerCase()}.</p>}
  </div>
}

function EditProfilePage() {
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
  const request = useRef(0)
  const artistRequest = useRef(0)
  const initialGenres = useRef([])
  const initialArtists = useRef([])
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
        setProfile({ name: user.name || '', username: user.username || '', bio: user.bio || '', pfp_link: user.pfp_link || '' })
        const rankedGenres = genreResult.value.sort((a, b) => Number(a.rank) - Number(b.rank)).map((item) => ({ ...item, title: item.title || item.name || item.genre || item.mbid }))
        const initialGenreList = rankedGenres.length ? rankedGenres : (user.fav_genres || []).slice(0, 3).map((genre) => ({ title: genre, mbid: genre, category: 'top_genres' }))
        const initialArtistList = artistResult.value.sort((a, b) => Number(a.rank) - Number(b.rank)).map((item) => ({
          ...item,
          title: artistMetadata.current.get(idOf(item)) || item.title || item.name || item.artist || item.mbid,
        }))
        initialGenres.current = initialGenreList.map((item) => ({ ...item }))
        initialArtists.current = initialArtistList.map((item) => ({ ...item }))
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
    setSaving(true); setSaveError(''); setNotice('')
    try {
      await apiRequest('/users/me', { method: 'PATCH', token, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: profile.name.trim(), username: profile.username.trim(), bio: profile.bio.trim() || null, pfp_link: profile.pfp_link || null, fav_genres: genres.map((item) => item.title) }) })
      await replaceRanked('top_genres', initialGenres.current, genres)
      await replaceRanked('top_artists', initialArtists.current, artists)
      const [freshGenres, freshArtists] = await Promise.all([
        getMyTasteList(profile.username, 'top_genres', token),
        getMyTasteList(profile.username, 'top_artists', token, applyArtistMetadata),
      ])
      const normalizedGenres = freshGenres.sort((a, b) => Number(a.rank) - Number(b.rank)).map((item) => ({ ...item, title: item.title || item.name || item.genre || item.mbid }))
      const normalizedArtists = freshArtists.sort((a, b) => Number(a.rank) - Number(b.rank)).map((item) => ({
        ...item,
        title: artistMetadata.current.get(idOf(item)) || item.title || item.name || item.artist || item.mbid,
      }))
      setGenres(normalizedGenres); setArtists(normalizedArtists)
      initialGenres.current = normalizedGenres.map((item) => ({ ...item }))
      initialArtists.current = normalizedArtists.map((item) => ({ ...item }))
      setNotice('Profile saved.')
    } catch (error) { setSaveError(error.message || 'Some changes could not be saved. Review your entries and try again.') }
    finally { setSaving(false) }
  }

  if (!token) return null
  return <main className="edit-profile-page">
    <AppHeader />
    <form className="edit-profile-board" onSubmit={save}>
      <section className="edit-pfp-row">
        <h1>Profile picture</h1>
        <img className="edit-pfp-preview" src={profile.pfp_link || '/images/profile-default.png'} alt="Profile picture preview" onError={(event) => { event.currentTarget.src = '/images/profile-default.png' }} />
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
      <div className="edit-field-row"><label htmlFor="edit-username">Username</label><input id="edit-username" value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} required /></div>
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
    </form>
  </main>
}

export default EditProfilePage
