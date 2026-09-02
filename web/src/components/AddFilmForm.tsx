import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { addFilmFn } from '../server/films'
import { searchMoviesFn, type TMDbMovie } from '../server/tmdb'

// A value typed as "slug/..." or "tmdb/..." goes straight to the backend;
// anything else is treated as a TMDB title search.
function isExplicitSlug(value: string): boolean {
  return value.includes('/')
}

export function AddFilmForm() {
  const navigate = useNavigate()
  const searchMovies = useServerFn(searchMoviesFn)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TMDbMovie[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const blurTimeout = useRef<number | null>(null)

  const isSlug = isExplicitSlug(query)
  const trimmed = query.trim()

  // Debounced TMDB search. Plain text → dropdown; "slug/..." → no dropdown.
  useEffect(() => {
    const value = query.trim()
    if (!value || isExplicitSlug(value)) {
      setResults(null)
      setOpen(false)
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      searchMovies({ data: { query: value } })
        .then((movies) => {
          setResults(movies)
          setActiveIndex(-1)
          setOpen(true)
          setError(null)
        })
        .catch(() => {
          setResults([])
          setOpen(true)
        })
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [query, searchMovies])

  async function addAndNavigate(slug: string) {
    setPending(true)
    setError(null)
    try {
      const film = await addFilmFn({ data: { slug } })
      setQuery('')
      setResults(null)
      setOpen(false)
      // Land on the film page so the user sees scraping progress + logs live.
      await navigate({ to: '/films/$slug', params: { slug: film.slug } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add film')
    } finally {
      setPending(false)
    }
  }

  function pickMovie(movie: TMDbMovie) {
    setOpen(false)
    void addAndNavigate(`tmdb/${movie.id}`)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!trimmed) return
    if (open && results && activeIndex >= 0 && results[activeIndex]) {
      pickMovie(results[activeIndex])
      return
    }
    if (isSlug) {
      void addAndNavigate(trimmed)
      return
    }
    // Plain title: Enter submits the top search result.
    if (results && results.length > 0) {
      pickMovie(results[0])
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || !results || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative mb-2">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              // Delay so a click on a result registers before the dropdown closes.
              blurTimeout.current = window.setTimeout(() => setOpen(false), 150)
            }}
            onFocus={() => {
              if (blurTimeout.current) window.clearTimeout(blurTimeout.current)
              if (results && results.length > 0 && !isSlug) setOpen(true)
            }}
            placeholder="Search a film or paste a slug…"
            className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-green-600/30 ${
              open ? 'border-green-600' : 'border-stone-300'
            }`}
            aria-label="Film title or letterboxd slug"
            role="combobox"
            aria-expanded={open}
            aria-controls="tmdb-results"
          />
          {searching && !isSlug && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
              searching…
            </span>
          )}
          {open && !isSlug && (
            <div
              id="tmdb-results"
              role="listbox"
              className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg shadow-stone-900/5"
            >
              {results && results.length > 0 ? (
                results.map((movie, i) => (
                  <button
                    key={movie.id}
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseDown={(e) => {
                      // mousedown fires before the input blur swallows the click.
                      e.preventDefault()
                      pickMovie(movie)
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`block w-full px-3 py-2 text-left text-sm ${
                      i === activeIndex
                        ? 'bg-green-50 text-green-900'
                        : 'text-stone-900'
                    }`}
                  >
                    <span className="font-semibold">{movie.title}</span>
                    {movie.release_date && (
                      <span className="text-stone-500">
                        {' '}
                        ({movie.release_date.slice(0, 4)})
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-stone-500">
                  {searching ? 'Searching…' : 'No results'}
                </p>
              )}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={pending || !trimmed}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add Film'}
        </button>
      </form>
      {isSlug && (
        <p className="mt-2 text-xs text-stone-500">
          Adding slug <span className="font-mono">{trimmed}</span> directly
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
