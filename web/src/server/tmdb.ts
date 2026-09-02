import { createServerFn } from '@tanstack/react-start'
import { searchMoviesImpl } from './tmdb.impl'

export type { TMDbMovie } from './tmdb.impl'

export const searchMoviesFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (typeof input !== 'object' || input === null) throw new Error('Invalid input')
    const obj = input as { query?: unknown }
    if (typeof obj.query !== 'string' || !obj.query.trim())
      throw new Error('query required (string)')
    return { query: obj.query.trim() }
  })
  .handler(async ({ data }) => searchMoviesImpl(data.query))
