import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { searchMoviesImpl } from './tmdb.impl'

export type { TMDbMovie } from './tmdb.impl'

const searchInput = z.object({
  query: z.string('query required (string)').trim().min(1, 'query required (string)'),
})

export const searchMoviesFn = createServerFn({ method: 'POST' })
  .validator(searchInput)
  .handler(async ({ data }) => searchMoviesImpl(data.query))
