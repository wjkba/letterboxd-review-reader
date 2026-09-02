import { asc, eq } from 'drizzle-orm'
import { db } from '../db'
import { films, scrapeLogs } from '../db/schema'
import type { ScrapeLog } from '../db/schema'

export async function getScrapeLogsImpl(slug: string): Promise<ScrapeLog[]> {
  const film = db.select().from(films).where(eq(films.slug, slug)).get()
  if (!film) return []
  return db
    .select()
    .from(scrapeLogs)
    .where(eq(scrapeLogs.filmId, film.id))
    .orderBy(asc(scrapeLogs.createdAt))
    .all()
}
