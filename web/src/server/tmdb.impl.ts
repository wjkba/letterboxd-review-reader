/**
 * Server-only TMDB logic. This file may import server-only modules; the
 * `tmdb.ts` wrapper is the only thing the client should ever reference.
 */

export interface TMDbMovie {
  id: number
  title: string
  release_date: string
}

export interface TMDbSearchResponse {
  results: TMDbMovie[]
}

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

/**
 * Search TMDB for movies by title. Returns [] when no token is configured
 * or the query is empty — callers can treat that as "no results".
 */
export async function searchMoviesImpl(query: string): Promise<TMDbMovie[]> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN
  const trimmed = query.trim()
  if (!token || !trimmed) return []

  const url = `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(
    trimmed,
  )}&include_adult=false`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`TMDB search failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as TMDbSearchResponse
  return data.results || []
}
