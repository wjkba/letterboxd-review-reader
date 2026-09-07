import * as cheerio from 'cheerio'
import { franc } from 'franc-min'
import { BASE_URL, CloudflareChallengeError, delay, getHTML, getHTMLWithRedirect } from './http'
import { parsePage } from './parse'
import type {
  PendingReview,
  ScrapedReview,
  ScrapeOptions,
  ScrapeResult,
  SortMode,
} from './types'

/**
 * Default allowlist: keep only English and Polish. `und` (undetermined) is
 * always kept — see `isLanguageAllowed`.
 */
const DEFAULT_ALLOWED_LANGUAGES = ['eng', 'pol'] as const

/**
 * Language detection below ~40 characters is unreliable; shorter reviews are
 * kept rather than dropped on a bad guess.
 */
const MIN_DETECTABLE_LENGTH = 40

/**
 * Language allowlist check on a review page's body text. Reviews whose
 * detected language is not in `allowedLanguages` are rejected. Falls back to
 * the whole page's text if the review markup differs. `und` (undetermined —
 * typically very short or emoji-heavy text, where detection is unreliable)
 * is always kept rather than dropped on a bad guess.
 */
function isLanguageAllowed(
  reviewHTML: string,
  allowedLanguages: readonly string[]
): boolean {
  if (allowedLanguages.length === 0) return true

  const $ = cheerio.load(reviewHTML)
  const text =
    $('.body-text').first().text().trim() || $.root().text().trim()
  if (text.length < MIN_DETECTABLE_LENGTH) return true

  const language = franc(text, { minLength: 10 })
  return language === 'und' || allowedLanguages.includes(language)
}

export async function resolveSlug(slugOrTmdbId: string): Promise<string> {
  if (!slugOrTmdbId.startsWith('tmdb/')) {
    return slugOrTmdbId
  }

  const tmdbId = slugOrTmdbId.replace('tmdb/', '')
  const url = `${BASE_URL}/tmdb/${tmdbId}`

  const { finalUrl } = await getHTMLWithRedirect(url)
  const match = finalUrl.match(/letterboxd\.com\/film\/([^/]+)/)

  if (match && match[1]) {
    return match[1]
  }

  throw new Error('Could not resolve slug from TMDB ID')
}

/**
 * User-facing link for the "View on Letterboxd" button. The film reviews
 * list page includes the exact per-review permalink (including the viewing
 * ordinal for rewatches) in each item's attribution link, so it is used
 * directly; the constructed author URL and the internal full-text URL
 * (`entry.reviewUrl`) are fallbacks when no permalink was parsed.
 */
function publicReviewUrl(entry: PendingReview, slug: string): string {
  return (
    entry.publicUrl ??
    (entry.author
      ? `${BASE_URL}/${entry.author}/film/${slug}/`
      : entry.reviewUrl)
  )
}

export async function scrapeFilmReviews(
  slug: string,
  options?: ScrapeOptions
): Promise<ScrapeResult> {
  const startPage = options?.startPage ?? 1
  const targetReviews = options?.targetReviews ?? 20
  const maxPages = options?.maxPages ?? 25
  const sortMode: SortMode = options?.sortMode ?? 'popular'
  const allowedLanguages: readonly string[] =
    options?.allowedLanguages ?? DEFAULT_ALLOWED_LANGUAGES
  // Base list URL per sort mode. `/page/N/` appends (trailing-slash replace)
  // work for both bases: "reviews/" → "reviews/page/2/".
  const popularUrl = `${BASE_URL}/film/${slug}/reviews/by/activity/`
  const newestUrl = `${BASE_URL}/film/${slug}/reviews/`

  const scrapedReviews: ScrapedReview[] = []
  // Dedupe by review URL: in mixed mode the same review can appear on pages
  // of both lists; also guards against repeats across pages of one list.
  const seen = new Set<string>()
  let pagesScraped = 0

  function pageUrlFor(base: string, page: number): string {
    return page > 1 ? base.replace(/\/$/, `/page/${page}/`) : base
  }

  /**
   * Phase (b): process one pending entry — target check, dedupe check
   * (duplicates never fetch full text or consume a fetch slot), fetch,
   * push, callback, delay.
   */
  async function processEntry(entry: PendingReview): Promise<void> {
    // Skip remaining reviews (and all further pages) once the target is
    // reached — before fetching any full review text.
    if (scrapedReviews.length >= targetReviews) return

    // Duplicate: don't fetch full text, don't push, don't count toward target.
    if (seen.has(entry.reviewUrl)) return
    seen.add(entry.reviewUrl)

    let reviewHTML: string
    try {
      reviewHTML = await getHTML(entry.reviewUrl)
    } catch (err) {
      // If Cloudflare is challenging us, every subsequent fetch will fail
      // too — abort the whole scrape with a clear message instead of
      // storing challenge pages as review content.
      throw err instanceof CloudflareChallengeError
        ? new Error(
            `Cloudflare challenge while fetching review — aborting scrape (${entry.reviewUrl})`
          )
        : err
    }

    // Language filter: drop reviews not in the allowed languages before
    // pushing or counting toward the target. The fetch already happened, so
    // keep the politeness delay before the loop moves on to the next entry.
    // `isLanguageAllowed` parses its own input, so it gets the full page.
    if (!isLanguageAllowed(reviewHTML, allowedLanguages)) {
      await delay(500)
      return
    }

    // Store the response as a body fragment, never a whole page document:
    // full-document markup (e.g. a Cloudflare challenge page that slipped
    // past the challenge guard, or an error shell) injected into the list
    // breaks layout and hijacks navigation. Normal full-text responses are
    // already bare review fragments with no document markup; a full document
    // means the response is not a review — skip rather than store it.
    // Cheerio re-serialization guarantees a balanced fragment either way.
    if (/<(!doctype|html|head|meta|script|style|body)[\s>]/i.test(reviewHTML)) {
      console.warn(
        `Full-document response instead of a review fragment — skipping: ${entry.reviewUrl}`
      )
      await delay(500)
      return
    }
    const $ = cheerio.load(reviewHTML)
    const bodyHTML = $('body').html()?.trim() ?? ''
    if (!bodyHTML) {
      console.warn(
        `Empty review fragment — skipping review: ${entry.reviewUrl}`
      )
      await delay(500)
      return
    }

    const review: ScrapedReview = {
      author: entry.author,
      authorUrl: entry.authorUrl,
      html: bodyHTML,
      reviewUrl: publicReviewUrl(entry, slug),
      viewingId: entry.viewingId,
      rating: entry.rating,
      watchedDate: entry.watchedDate,
      stream: entry.stream,
    }
    scrapedReviews.push(review)
    await options?.onReview?.(review, scrapedReviews.length)
    await delay(500)
  }

  /** Process pending entries in order (single-stream page). */
  async function processEntries(entries: PendingReview[]): Promise<void> {
    for (const entry of entries) {
      await processEntry(entry)
    }
  }

  if (sortMode === 'mixed') {
    // Review-level interleaving: each round fetches one page per stream
    // (popular page N, newest page N), parses both into pending batches,
    // then processes them round-robin: popular[0], newest[0], popular[1],
    // newest[1], .... When one batch runs dry, the other's remaining entries
    // continue. A stream is exhausted once a page yields zero review
    // elements; maxPages is the total budget across both streams.
    const next: Record<'popular' | 'newest', number> = {
      popular: startPage,
      newest: startPage,
    }
    const done: Record<'popular' | 'newest', boolean> = {
      popular: false,
      newest: false,
    }

    while (
      pagesScraped < maxPages &&
      scrapedReviews.length < targetReviews &&
      !(done.popular && done.newest)
    ) {
      // Fetch one page per stream, popular first.
      const batches: PendingReview[][] = []
      for (const stream of ['popular', 'newest'] as const) {
        if (done[stream]) continue
        if (pagesScraped >= maxPages) break
        if (scrapedReviews.length >= targetReviews) break

        const base = stream === 'popular' ? popularUrl : newestUrl
        const html = await getHTML(pageUrlFor(base, next[stream]))
        pagesScraped++
        next[stream]++

        const parsed = parsePage(html, stream)
        if (!parsed.hasElements) done[stream] = true
        else batches.push(parsed.entries)
      }

      // Round-robin across the two batches until both are drained
      // (or the target is reached — the while condition guarantees exit even
      // when entries remain in the batches).
      while (
        scrapedReviews.length < targetReviews &&
        batches.some((batch) => batch.length > 0)
      ) {
        for (const batch of batches) {
          if (scrapedReviews.length >= targetReviews) break
          const entry = batch.shift()
          if (entry) await processEntry(entry)
        }
      }
    }
  } else {
    // Single stream: the mode's base list, pages in order.
    const base = sortMode === 'newest' ? newestUrl : popularUrl
    const stream: 'popular' | 'newest' =
      sortMode === 'newest' ? 'newest' : 'popular'

    for (let page = startPage; page <= maxPages; page++) {
      // Stop before fetching anything else once the target is reached.
      if (scrapedReviews.length >= targetReviews) break

      const html = await getHTML(pageUrlFor(base, page))
      pagesScraped++

      await processEntries(parsePage(html, stream).entries)
    }
  }

  return {
    slug,
    reviews: scrapedReviews,
    pagesScraped,
    sortMode,
  }
}
