import { count, eq } from 'drizzle-orm'
import { db } from '../db'
import type { Film, ScrapeJob } from '../db/schema'
import { films, reviews, scrapeJobs } from '../db/schema'
import { scrapeFilmReviews } from '../scraper'
import { getSortModeImpl, getTargetReviewsImpl } from './settings.impl'

/**
 * Derive a display title from a Letterboxd slug ("the-grand-budapest-hotel"
 * → "The Grand Budapest Hotel"). Used only on first insert; the real title
 * can be backfilled later once a TMDB integration lands.
 */
export function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Record the film (under the unresolved slug) and the job as failed.
 * Used when slug resolution fails — surfaces as a scrape failure instead of
 * crashing.
 */
export async function recordFailedScrape(
  slug: string,
  message: string
): Promise<Film> {
  const [film] = await db
    .insert(films)
    .values({
      slug,
      title: titleFromSlug(slug),
      scrapeStatus: 'failed',
      scrapeError: message,
    })
    .onConflictDoUpdate({
      target: films.slug,
      set: { scrapeStatus: 'failed', scrapeError: message },
    })
    .returning()

  await db
    .insert(scrapeJobs)
    .values({ filmId: film.id, status: 'failed', startedAt: Date.now(), finishedAt: Date.now(), error: message })

  return film
}

/**
 * Background scrape task body: fetch reviews from Letterboxd, insert them
 * incrementally, then update the film and job rows with the outcome. The
 * whole body is wrapped in try/catch so the queue's dedupe Map cleanup always
 * fires, and so a failure marks the film/job instead of surfacing as a
 * rejected promise.
 */
export async function runScrapeJob(
  film: Film,
  job: ScrapeJob,
  filmSlug: string
): Promise<void> {
  const resolvedTag = `[scrape:${filmSlug}]`
  try {
    console.log(`${resolvedTag} Fetching reviews from Letterboxd…`)

    const targetReviews = await getTargetReviewsImpl()
    const sortMode = await getSortModeImpl()
    console.log(
      `${resolvedTag} Target: ${targetReviews} long-form reviews (${sortMode})`,
    )

    let insertedCount = 0
    const result = await scrapeFilmReviews(filmSlug, {
      targetReviews,
      sortMode,
      // Insert each review as it is scraped so the UI's polled
      // reviewCount grows live during the scrape.
      onReview: async (review, index) => {
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
        insertedCount += inserted.length

        await db
          .update(films)
          .set({ reviewCount: insertedCount })
          .where(eq(films.id, film.id))

        console.log(
          `${resolvedTag} Fetched ${index} reviews (${review.author})`,
        )
      },
    })

    const reviewsAdded = insertedCount

    // Query the actual count so film.reviewCount is accurate even when
    // some reviews conflicted with existing rows.
    const [{ total }] = await db
      .select({ total: count() })
      .from(reviews)
      .where(eq(reviews.filmId, film.id))

    // Reset read progress when the scrape brought in new reviews, so a
    // previously-read film returns to 'unread' with fresh content. If no new
    // reviews were found, leave the user's progress untouched.
    const resetProgress = total > film.reviewCount

    await db
      .update(films)
      .set({
        reviewCount: total,
        lastScrapedAt: Date.now(),
        scrapeStatus: 'completed',
        scrapeError: null,
        ...(resetProgress
          ? { readStatus: 'unread' as const, reviewsRead: 0 }
          : {}),
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

    console.log(`${resolvedTag} Scrape complete: ${reviewsAdded} reviews added`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    console.error(`${resolvedTag} Scrape failed: ${message}`)

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
}
