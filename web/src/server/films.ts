import { createServerFn } from '@tanstack/react-start'
import { addFilmImpl, getFilmImpl, listFilmsImpl } from './films.impl'

export const listFilmsFn = createServerFn({ method: 'GET' }).handler(
  async () => listFilmsImpl(),
)

export const addFilmFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (typeof input !== 'object' || input === null) throw new Error('Invalid input')
    const obj = input as { slug?: unknown }
    if (typeof obj.slug !== 'string' || !obj.slug.trim()) throw new Error('slug required (string)')
    return { slug: obj.slug.trim().toLowerCase() }
  })
  .handler(async ({ data }) => addFilmImpl(data.slug))

export const getFilmFn = createServerFn({ method: 'GET' })
  .validator((input: unknown) => {
    if (typeof input !== 'object' || input === null) throw new Error('Invalid input')
    const obj = input as { slug?: unknown }
    if (typeof obj.slug !== 'string' || !obj.slug.trim()) throw new Error('slug required (string)')
    return { slug: obj.slug.trim().toLowerCase() }
  })
  .handler(async ({ data }) => getFilmImpl(data.slug))
