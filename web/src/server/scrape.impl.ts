import { count, eq } from 'drizzle-orm'
import { db } from '../db'
import { films, reviews, scrapeJobs, scrapeLogs } from '../db/schema'
import type { NewScrapeLog } from '../db/schema'
import { scrapeFilmReviews } from '../scraper'
import { enqueueScrape } from '../queue'

/**
 * Derive a display title from a Letterboxd slug ("the-grand-budapest-hotel"
 * → "The Grand Budapest Hotel"). Used only on first insert; the real title
 * can be backfilled later once a TMDB integration lands.
 */
function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Append a progress-log row for a film's scrape. Never throws: a logging
 * failure must not take down the scrape itself.
 */
function log(filmId: number, message: string, level: NewScrapeLog['level'] = 'info') {
  return db
    .insert(scrapeLogs)
    .values({ filmId, message, level })
    .catch((err) => {
      console.error(`[scrape] failed to write log for film ${filmId}:`, err)
    })
}

/**
 * Upsert the film row (status='scraping'), record a scrape_jobs row, then
 * enqueue the actual scrape as background work. Returns the film record
 * immediately — the caller should poll film status / reviews for progress.
 */
export async function triggerScrapeImpl(slug: string) {
  const normalized = slug.trim().toLowerCase()

  // 1. Upsert film row; if it already exists, reset it to 'scraping'.
  const [film] = await db
    .insert(films)
    .values({
      slug: normalized,
      title: titleFromSlug(normalized),
      scrapeStatus: 'scraping',
    })
    .onConflictDoUpdate({
      target: films.slug,
      set: { scrapeStatus: 'scraping', scrapeError: null },
    })
    .returning()

  // 2. Record the job.
  const [job] = await db
    .insert(scrapeJobs)
    .values({ filmId: film.id, status: 'running', startedAt: Date.now() })
    .returning()

  // 3. Enqueue background scrape work. The whole task body is wrapped in
  //    try/catch so the queue's dedupe Map cleanup always fires, and so a
  //    failure marks the film/job instead of surfacing as a rejected promise.
  await log(film.id, 'Scrape started')

  void enqueueScrape(normalized, async () => {
    try {
      await log(film.id, 'Fetching reviews from Letterboxd…')
      const result = await scrapeFilmReviews(normalized)
      await log(film.id, `Fetched ${result.reviews.length} reviews`)

      let reviewsAdded = 0
      for (const review of result.reviews) {
        const inserted = await db
          .insert(reviews)
          .values({
            filmId: film.id,
            author: review.author,
            authorUrl: review.authorUrl,
            rating: review.rating,
            watchedDate: review.watchedDate,
            reviewUrl: review.reviewUrl,
            html: review.html,
            scrapedAt: Date.now(),
          })
          .onConflictDoNothing({
            target: [reviews.filmId, reviews.reviewUrl],
          })
          .returning()
        reviewsAdded += inserted.length
      }

      // Query the actual count so film.reviewCount is accurate even when
      // some reviews conflicted with existing rows.
      const [{ total }] = await db
        .select({ total: count() })
        .from(reviews)
        .where(eq(reviews.filmId, film.id))

      await db
        .update(films)
        .set({
          reviewCount: total,
          lastScrapedAt: Date.now(),
          scrapeStatus: 'completed',
          scrapeError: null,
        })
        .where(eq(films.id, film.id))

      await db
        .update(scrapeJobs)
        .set({
          status: 'completed',
          finishedAt: Date.now(),
          pagesScraped: result.pagesScraped,
          reviewsAdded,
          error: null,
        })
        .where(eq(scrapeJobs.id, job.id))

      await log(film.id, `Scrape complete: ${reviewsAdded} reviews added`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      await log(film.id, `Scrape failed: ${message}`, 'error')

      await db
        .update(films)
        .set({
          scrapeStatus: 'failed',
          scrapeError: message,
          lastScrapedAt: Date.now(),
        })
        .where(eq(films.id, film.id))

      await db
        .update(scrapeJobs)
        .set({
          status: 'failed',
          finishedAt: Date.now(),
          error: message,
        })
        .where(eq(scrapeJobs.id, job.id))
    }
  })

  // 4. Return immediately; the scrape continues in the background.
  return film
}
