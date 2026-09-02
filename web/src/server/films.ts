import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { films } from '../db/schema'
import { triggerScrapeImpl } from './scrape'

export async function listFilmsImpl() {
  return db.select().from(films).orderBy(desc(films.addedAt)).all()
}

export const listFilmsFn = createServerFn({ method: 'GET' }).handler(
  async () => listFilmsImpl(),
)

export async function addFilmImpl(slug: string) {
  return triggerScrapeImpl(slug) // upserts film + triggers scrape
}

export const addFilmFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (typeof input !== 'object' || input === null) throw new Error('Invalid input')
    const obj = input as { slug?: unknown }
    if (typeof obj.slug !== 'string' || !obj.slug.trim()) throw new Error('slug required (string)')
    return { slug: obj.slug.trim().toLowerCase() }
  })
  .handler(async ({ data }) => addFilmImpl(data.slug))

export async function getFilmImpl(slug: string) {
  const film = db.select().from(films).where(eq(films.slug, slug)).get()
  if (!film) throw new Error(`Film not found: ${slug}`)
  return film
}

export const getFilmFn = createServerFn({ method: 'GET' })
  .validator((input: unknown) => {
    if (typeof input !== 'object' || input === null) throw new Error('Invalid input')
    const obj = input as { slug?: unknown }
    if (typeof obj.slug !== 'string' || !obj.slug.trim()) throw new Error('slug required (string)')
    return { slug: obj.slug.trim().toLowerCase() }
  })
  .handler(async ({ data }) => getFilmImpl(data.slug))
