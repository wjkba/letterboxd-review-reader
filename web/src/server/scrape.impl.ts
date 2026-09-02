import { count, eq } from 'drizzle-orm'
import { db } from '../db'
import { films, reviews, scrapeJobs } from '../db/schema'
import { resolveSlug, scrapeFilmReviews } from '../scraper'
import { enqueueScrape } from '../queue'
import { getSortModeImpl, getTargetReviewsImpl } from './settings.impl'

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
 * Upsert the film row (status='scraping'), record a scrape_jobs row, then
 * enqueue the actual scrape as background work. Returns the film record
 * immediately — the caller should poll film status / reviewCount for progress.
 */
export async function triggerScrapeImpl(slug: string) {
  const normalized = slug.trim().toLowerCase()
  const tag = `[scrape:${normalized}]`

  // 0. Resolve TMDB references ("tmdb/496243") to their real Letterboxd slug
  //    ("parasite") via the letterboxd.com/tmdb/{id} redirect. Everything
  //    below (upsert, scrape, title) uses the resolved slug.
  let filmSlug = normalized
  try {
    filmSlug = await resolveSlug(normalized)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`${tag} Slug resolution failed: ${message}`)

    // Surface as a scrape failure instead of crashing: record the film
    // (under the unresolved slug) and the job as failed.
    const [film] = await db
      .insert(films)
      .values({
        slug: normalized,
        title: titleFromSlug(normalized),
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

  const resolvedTag = `[scrape:${filmSlug}]`

  // 1. Upsert film row; if it already exists, reset it to 'scraping'.
  const [film] = await db
    .insert(films)
    .values({
      slug: filmSlug,
      title: titleFromSlug(filmSlug),
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

  console.log(`${resolvedTag} Scrape started`)

  // 3. Enqueue background scrape work. The whole task body is wrapped in
  //    try/catch so the queue's dedupe Map cleanup always fires, and so a
  //    failure marks the film/job instead of surfacing as a rejected promise.
  //    Dedupe on the resolved slug so "tmdb/496243" and "parasite" queue
  //    against the same key.
  void enqueueScrape(filmSlug, async () => {
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
  })

  // 4. Return immediately; the scrape continues in the background.
  return film
}
