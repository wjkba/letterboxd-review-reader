/**
 * Server-only settings logic. This file may import server-only modules; the
 * `settings.ts` wrapper is the only thing the client should ever reference.
 */

import { eq } from 'drizzle-orm'
import type { SortMode } from '../scraper'
import { db } from '../db'
import { settings } from '../db/schema'

export const TARGET_REVIEWS_KEY = 'targetLongReviews'
export const TARGET_REVIEWS_DEFAULT = 20

export const REVIEW_SORT_MODE_KEY = 'reviewSortMode'
export const REVIEW_SORT_MODE_DEFAULT: SortMode = 'popular'

const SORT_MODES: readonly SortMode[] = ['popular', 'newest', 'mixed']

function isSortMode(value: string): value is SortMode {
  return (SORT_MODES as readonly string[]).includes(value)
}

function clamp(value: number): number {
  return Math.min(100, Math.max(1, Math.round(value)))
}

/**
 * Read the target number of long-form reviews to scrape per film.
 * Falls back to the default when the row is missing or unparseable.
 */
export async function getTargetReviewsImpl(): Promise<number> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, TARGET_REVIEWS_KEY))
    .limit(1)

  if (!row) return TARGET_REVIEWS_DEFAULT
  const parsed = Number.parseInt(row.value, 10)
  if (Number.isNaN(parsed)) return TARGET_REVIEWS_DEFAULT
  return clamp(parsed)
}

/** Clamp and upsert the target number of long-form reviews per film. */
export async function setTargetReviewsImpl(value: number): Promise<number> {
  const clamped = clamp(value)

  await db
    .insert(settings)
    .values({ key: TARGET_REVIEWS_KEY, value: String(clamped) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: String(clamped) },
    })

  return clamped
}

/**
 * Read which Letterboxd reviews list the scraper should pull from.
 * Falls back to "popular" when the row is missing or holds an unknown value.
 */
export async function getSortModeImpl(): Promise<SortMode> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, REVIEW_SORT_MODE_KEY))
    .limit(1)

  if (!row || !isSortMode(row.value)) return REVIEW_SORT_MODE_DEFAULT
  return row.value
}

/** Validate and upsert the reviews list sort mode. */
export async function setSortModeImpl(mode: SortMode): Promise<SortMode> {
  if (!isSortMode(mode)) {
    throw new Error(`Invalid sort mode: ${String(mode)}`)
  }

  await db
    .insert(settings)
    .values({ key: REVIEW_SORT_MODE_KEY, value: mode })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: mode },
    })

  return mode
}
