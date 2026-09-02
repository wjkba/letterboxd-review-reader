import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  addFilmImpl,
  getFilmImpl,
  listFilmsImpl,
} from './films.impl'

const slugInput = z
  .object({
    slug: z.string('slug required (string)').trim().min(1, 'slug required (string)'),
  })
  .transform(({ slug }) => ({ slug: slug.toLowerCase() }))

export const listFilmsFn = createServerFn({ method: 'GET' }).handler(
  async () => listFilmsImpl(),
)

export const addFilmFn = createServerFn({ method: 'POST' })
  .validator(slugInput)
  .handler(async ({ data }) => addFilmImpl(data.slug))

export const getFilmFn = createServerFn({ method: 'GET' })
  .validator(slugInput)
  .handler(async ({ data }) => getFilmImpl(data.slug))
