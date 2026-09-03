import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { TMDbMovie } from '#/server/tmdb'

export type { TMDbMovie }

type SearchMoviesFn = (args: { data: { query: string } }) => Promise<TMDbMovie[]>

// A value typed as "slug/..." or "tmdb/..." goes straight to the backend;
// anything else is treated as a TMDB title search.
export function isExplicitSlug(value: string): boolean {
  return value.includes('/')
}

/**
 * State + keyboard/focus behaviour for the add-film combobox:
 * debounced TMDB title search, dropdown open/active-index tracking, and the
 * blur-timeout handling that lets a click on a result land before close.
 *
 * `onSearchSuccess` fires after a successful search (used by the form to
 * clear its submit error). Kept in a ref so the debounce effect's
 * dependencies stay exactly `[query, searchMovies]`.
 */
export function useTmdbSearch(
  searchMovies: SearchMoviesFn,
  onSearchSuccess?: () => void,
) {
  const onSuccessRef = useRef(onSearchSuccess)
  useEffect(() => {
    onSuccessRef.current = onSearchSuccess
  })

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TMDbMovie[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
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
          onSuccessRef.current?.()
        })
        .catch(() => {
          setResults([])
          setOpen(true)
        })
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [query, searchMovies])

  function onBlur() {
    // Delay so a click on a result registers before the dropdown closes.
    blurTimeout.current = window.setTimeout(() => setOpen(false), 150)
  }

  function onFocus() {
    if (blurTimeout.current) window.clearTimeout(blurTimeout.current)
    if (results && results.length > 0 && !isSlug) setOpen(true)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
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

  return {
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
  }
}
