import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { films, reviews } from '../db/schema'

export async function getReviewsImpl(slug: string, limit = 100) {
  const film = db.select().from(films).where(eq(films.slug, slug)).get()
  if (!film) throw new Error(`Film not found: ${slug}`)
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.filmId, film.id))
    .orderBy(desc(reviews.scrapedAt))
    .limit(limit)
    .all()
}

export const getReviewsFn = createServerFn({ method: 'GET' })
  .validator((input: unknown) => {
    if (typeof input !== 'object' || input === null) {
      return { slug: '', limit: 100 } as { slug: string; limit: number }
    }
    const obj = input as { slug?: unknown; limit?: unknown }
    const slug = typeof obj.slug === 'string' ? obj.slug.trim().toLowerCase() : ''
    const limit =
      typeof obj.limit === 'number' && obj.limit > 0 ? Math.min(obj.limit, 500) : 100
    if (!slug) throw new Error('slug required (string)')
    return { slug, limit }
  })
  .handler(async ({ data }) => getReviewsImpl(data.slug, data.limit))
