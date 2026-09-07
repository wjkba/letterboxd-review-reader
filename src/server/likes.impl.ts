/**
 * Server-only review-liking logic. This file may import server-only modules;
 * the `likes.ts` wrapper is the only thing the client should ever reference.
 * The LETTERBOXD_COOKIE secret must never be logged or returned to the client.
 */

import { eq } from 'drizzle-orm'
import { gotScraping } from 'got-scraping'
import { BASE_URL, headerGeneratorOptions } from '../scraper/http'
import { db } from '../db'
import { reviews } from '../db/schema'

export interface LikeReviewResult {
  ok: boolean
  liked?: boolean
  likes?: number | null
  error: string | null
}

/** 30s timeout for the like POST, matching the scraper's request timeout. */
const LIKE_TIMEOUT_MS = 30_000

/**
 * Extract the `com.xk72.webparts.csrf` token from the raw cookie string.
 * Returns null when the cookie string is missing the token.
 */
export function parseCsrfToken(cookie: string): string | null {
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === 'com.xk72.webparts.csrf') {
      const value = rest.join('=').trim()
      return value.length > 0 ? value : null
    }
  }
  return null
}

/**
 * Like or unlike a stored review on Letterboxd via its internal viewing id,
 * authenticating with the raw cookie string from LETTERBOXD_COOKIE. When a
 * cf_clearance cookie is present, LETTERBOXD_USER_AGENT must match the browser
 * that minted it (Cloudflare binds clearance to the user agent), so the exact
 * stored UA is sent verbatim instead of a generated one.
 * Never includes the cookie or any secret in the returned error messages.
 */
export async function likeReviewImpl(
  reviewId: number,
  wantLiked: boolean,
): Promise<LikeReviewResult> {
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1)

  if (!review) {
    return { ok: false, error: 'Review not found' }
  }

  if (!review.viewingId) {
    return {
      ok: false,
      error: 'This review has no like target yet — re-scrape the film first',
    }
  }

  const cookie = process.env.LETTERBOXD_COOKIE
  if (!cookie) {
    return {
      ok: false,
      error: 'Letterboxd account not configured (LETTERBOXD_COOKIE missing)',
    }
  }

  const csrf = parseCsrfToken(cookie)
  if (!csrf) {
    return {
      ok: false,
      error:
        'Letterboxd account not configured (LETTERBOXD_COOKIE missing com.xk72.webparts.csrf token)',
    }
  }
  // With cf_clearance in play the user agent must match it exactly, so skip
  // header generation and send the stored browser UA verbatim.
  const storedUserAgent = process.env.LETTERBOXD_USER_AGENT
  const headers: Record<string, string> = {
    cookie,
    accept: '*/*',
    'content-type': 'application/x-www-form-urlencoded',
    origin: BASE_URL,
    referer: review.reviewUrl,
  }
  if (storedUserAgent) headers['user-agent'] = storedUserAgent

  const response = await gotScraping({
    url: `${BASE_URL}/s/viewing:${review.viewingId}/like/`,
    method: 'POST',
    ...(storedUserAgent ? {} : { headerGeneratorOptions }),
    headers,
    form: { liked: wantLiked ? 'true' : 'false', __csrf: csrf },
    timeout: { request: LIKE_TIMEOUT_MS },
    retry: { limit: 0 },
    throwHttpErrors: false,
  }).catch(() => null)

  if (!response) {
    return { ok: false, error: 'Like failed (request error)' }
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const status = response.statusCode
    const hint =
      status === 403
        ? ' — try refreshing LETTERBOXD_COOKIE and LETTERBOXD_USER_AGENT'
        : ''
    return { ok: false, error: `Like failed (HTTP ${status})${hint}` }
  }

  let result: {
    result?: unknown
    liked?: unknown
    count?: unknown
  }
  try {
    result = JSON.parse(response.body)
  } catch {
    return { ok: false, error: 'Like failed (unexpected response)' }
  }

  if (result.result !== true) {
    return { ok: false, error: 'Like failed (rejected by Letterboxd)' }
  }

  const confirmedLiked = result.liked === true
  const likes = typeof result.count === 'number' ? result.count : null

  await db
    .update(reviews)
    .set({ liked: confirmedLiked })
    .where(eq(reviews.id, reviewId))

  return { ok: true, liked: confirmedLiked, likes, error: null }
}
