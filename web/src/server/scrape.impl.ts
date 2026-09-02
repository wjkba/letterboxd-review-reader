import { db } from '../db'
import { films, scrapeJobs } from '../db/schema'
import { resolveSlug } from '../scraper'
import { enqueueScrape } from '../queue'
import { recordFailedScrape, runScrapeJob, titleFromSlug } from './scrape-job'

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
    return recordFailedScrape(normalized, message)
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

  // 3. Enqueue background scrape work (see runScrapeJob for the task body).
  //    Dedupe on the resolved slug so "tmdb/496243" and "parasite" queue
  //    against the same key.
  void enqueueScrape(filmSlug, () => runScrapeJob(film, job, filmSlug))

  // 4. Return immediately; the scrape continues in the background.
  return film
}
