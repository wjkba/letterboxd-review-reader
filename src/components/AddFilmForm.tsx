import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { addFilmFn } from '../server/films'
import { searchMoviesFn } from '../server/tmdb'
import { useTmdbSearch, type TMDbMovie } from '#/hooks/use-tmdb-search'

export function AddFilmForm() {
  const navigate = useNavigate()
  const searchMovies = useServerFn(searchMoviesFn)

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    query,
    setQuery,
    results,
    setResults,
    searching,
    open,
    setOpen,
    activeIndex,
    setActiveIndex,
    isSlug,
    trimmed,
    onBlur,
    onFocus,
    onKeyDown,
  } = useTmdbSearch(searchMovies, () => setError(null))

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

  return (
    <div className="relative mb-2">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            onFocus={onFocus}
            placeholder="Search a film or paste a slug…"
            className="min-h-11 w-full border border-ink-border bg-ink-bg px-3 py-2 text-sm text-ink-fg placeholder:text-ink-meta"
            aria-label="Film title or letterboxd slug"
            role="combobox"
            aria-expanded={open}
            aria-controls="tmdb-results"
          />
          {searching && !isSlug && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-meta">
              searching…
            </span>
          )}
          {open && !isSlug && (
            <div
              id="tmdb-results"
              role="listbox"
              className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto border-2 border-ink-border bg-ink-bg"
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
                    className={`flex min-h-11 w-full items-center px-3 text-left text-sm ${
                      i === activeIndex
                        ? 'bg-ink-fg text-ink-bg'
                        : 'text-ink-fg can-hover:bg-ink-hover'
                    }`}
                  >
                    <span className="font-semibold">{movie.title}</span>
                    {movie.release_date && (
                      <span
                        className={
                          i === activeIndex ? 'text-ink-bg' : 'text-ink-meta'
                        }
                      >
                        {' '}
                        ({movie.release_date.slice(0, 4)})
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-ink-meta">
                  {searching ? 'Searching…' : 'No results'}
                </p>
              )}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={pending || !trimmed}
          className="min-h-11 border border-ink-border bg-ink-bg px-4 py-2 text-sm font-medium text-ink-fg active:bg-ink-fg active:text-ink-bg can-hover:bg-ink-hover disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add Film'}
        </button>
      </form>
      {isSlug && (
        <p className="mt-2 text-xs text-ink-meta">
          Adding slug <span className="font-mono">{trimmed}</span> directly
        </p>
      )}
      {error && (
        <p aria-live="assertive" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
