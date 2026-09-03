import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  addFilmImpl,
  deleteFilmImpl,
  getFilmImpl,
  listFilmsImpl,
  rescrapeFilmImpl,
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

// NOTE: uses POST because the installed @tanstack/start-client-core only
// allows Method = 'GET' | 'POST' on createServerFn. The client contract
// (`await deleteFilmFn({ data: { slug } })`) is unaffected.
export const deleteFilmFn = createServerFn({ method: 'POST' })
  .validator(slugInput)
  .handler(async ({ data }) => deleteFilmImpl(data.slug))

export const rescrapeFilmFn = createServerFn({ method: 'POST' })
  .validator(slugInput)
  .handler(async ({ data }) => rescrapeFilmImpl(data.slug))
