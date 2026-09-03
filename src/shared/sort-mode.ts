/**
 * Shared review-sort-mode domain type.
 *
 * Lives in shared (not in src/scraper) so client code can import it without
 * pulling the scraper's server-only dependencies (got-scraping, cheerio).
 */
export type SortMode = 'popular' | 'newest' | 'mixed'

export const SORT_MODES: readonly SortMode[] = ['popular', 'newest', 'mixed']

export function isSortMode(value: string): value is SortMode {
  return (SORT_MODES as readonly string[]).includes(value)
}
