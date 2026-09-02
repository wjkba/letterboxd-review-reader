import type { SortMode } from '#/shared/sort-mode'

export type { SortMode }

export interface ScrapeOptions {
  startPage?: number
  targetReviews?: number
  maxPages?: number
  /** Which Letterboxd reviews list to pull from (default "popular"). */
  sortMode?: SortMode
  /**
   * ISO 639-3 language codes to exclude (default: rus, bul, spa, ara, arb).
   * Detected from the fetched full review text; `und` (undetermined,
   * e.g. very short or emoji-only reviews) is never excluded.
   * Note: `bul` is included by default because franc cannot reliably
   * distinguish Bulgarian from Russian.
   */
  excludedLanguages?: string[]
  /** Called after each review is scraped (before the inter-request delay). */
  onReview?: (review: ScrapedReview, index: number) => Promise<void> | void
}

export interface ScrapedReview {
  author: string
  authorUrl: string | null
  html: string
  reviewUrl: string
  rating: number | null
  watchedDate: string | null
  /** Which reviews list this review came from (tagged at parse time). */
  stream?: 'popular' | 'newest'
}

/** A parsed long-form review entry that has not had its full text fetched yet. */
export interface PendingReview {
  author: string
  authorUrl: string | null
  reviewUrl: string
  rating: number | null
  watchedDate: string | null
  stream: 'popular' | 'newest'
}

export interface ScrapeResult {
  slug: string
  reviews: ScrapedReview[]
  pagesScraped: number
  sortMode?: SortMode
}
