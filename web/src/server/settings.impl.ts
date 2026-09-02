/**
 * Server-only settings logic. This file may import server-only modules; the
 * `settings.ts` wrapper is the only thing the client should ever reference.
 */

import { eq } from 'drizzle-orm'
import { db } from '../db'
import { settings } from '../db/schema'

export const TARGET_REVIEWS_KEY = 'targetLongReviews'
export const TARGET_REVIEWS_DEFAULT = 20

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
