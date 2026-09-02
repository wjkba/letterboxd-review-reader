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
