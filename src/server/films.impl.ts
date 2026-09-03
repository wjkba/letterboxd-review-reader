import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { films } from '../db/schema'
import { triggerScrapeImpl } from './scrape.impl'

export async function listFilmsImpl() {
  return db.select().from(films).orderBy(desc(films.addedAt)).all()
}

export async function addFilmImpl(slug: string) {
  return triggerScrapeImpl(slug) // upserts film + triggers scrape
}

export async function getFilmImpl(slug: string) {
  const film = db.select().from(films).where(eq(films.slug, slug)).get()
  if (!film) throw new Error(`Film not found: ${slug}`)
  return film
}

export async function deleteFilmImpl(slug: string) {
  // Idempotent: reviews/scrape_jobs cascade on filmId, so one delete is enough.
  db.delete(films).where(eq(films.slug, slug)).run()
}

export async function rescrapeFilmImpl(slug: string) {
  return triggerScrapeImpl(slug) // upserts film + re-triggers scrape
}
