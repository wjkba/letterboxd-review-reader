import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { setFilmReadStatusImpl, updateFilmProgressImpl } from './progress.impl'

const progressInput = z
  .object({
    slug: z.string('slug required (string)').trim().min(1, 'slug required (string)'),
    reviewsRead: z.number().int().min(0),
  })
  .transform(({ slug, reviewsRead }) => ({ slug: slug.toLowerCase(), reviewsRead }))

const readStatusInput = z
  .object({
    slug: z.string('slug required (string)').trim().min(1, 'slug required (string)'),
    status: z.enum(['unread', 'read']),
  })
  .transform(({ slug, status }) => ({ slug: slug.toLowerCase(), status }))

// NOTE: uses POST because the installed @tanstack/start-client-core only
// allows Method = 'GET' | 'POST' on createServerFn. The client contract
// (`await updateFilmProgressFn({ data: { slug, reviewsRead } })`) is unaffected.
export const updateFilmProgressFn = createServerFn({ method: 'POST' })
  .validator(progressInput)
  .handler(async ({ data }) => updateFilmProgressImpl(data.slug, data.reviewsRead))

export const setFilmReadStatusFn = createServerFn({ method: 'POST' })
  .validator(readStatusInput)
  .handler(async ({ data }) => setFilmReadStatusImpl(data.slug, data.status))
