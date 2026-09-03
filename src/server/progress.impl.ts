import { eq } from 'drizzle-orm'
import { db } from '../db'
import { films } from '../db/schema'

export type ReadStatus = 'unread' | 'reading' | 'read'

/**
 * Update how many reviews of a film have been read.
 * Clamps reviewsRead to [0, reviewCount] and derives readStatus:
 * - fully read (reviewCount > 0 and reviewsRead >= reviewCount) → 'read'
 * - otherwise → 'reading', unless the film is already 'read' (never downgrade)
 */
export async function updateFilmProgressImpl(
  slug: string,
  reviewsRead: number,
) {
  const film = db.select().from(films).where(eq(films.slug, slug)).get()
  if (!film) throw new Error('Film not found')

  const clamped = Math.max(0, Math.min(reviewsRead, film.reviewCount))

  let readStatus: ReadStatus
  let nextRead: number
  if (film.reviewCount > 0 && clamped >= film.reviewCount) {
    readStatus = 'read'
    nextRead = film.reviewCount
  } else {
    readStatus = film.readStatus === 'read' ? 'read' : 'reading'
    nextRead = clamped
  }

  const [updated] = await db
    .update(films)
    .set({ readStatus, reviewsRead: nextRead })
    .where(eq(films.id, film.id))
    .returning()

  return updated
}

/**
 * Explicitly set a film's read status. 'read' marks all reviews as read,
 * 'unread' clears progress entirely.
 */
export async function setFilmReadStatusImpl(
  slug: string,
  status: 'unread' | 'read',
) {
  const film = db.select().from(films).where(eq(films.slug, slug)).get()
  if (!film) throw new Error('Film not found')

  const patch =
    status === 'read'
      ? { readStatus: 'read' as const, reviewsRead: film.reviewCount }
      : { readStatus: 'unread' as const, reviewsRead: 0 }

  const [updated] = await db
    .update(films)
    .set(patch)
    .where(eq(films.id, film.id))
    .returning()

  return updated
}
