import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import { BASE_URL } from './http'
import type { PendingReview } from './types'

function parseRating(_: CheerioAPI, el: cheerio.Cheerio<any>): number | null {
  const ratingEl = el.find('.rating').first()

  // Legacy markup: Letterboxd marked ratings with classes like "rated-8"
  // (0.5-star scale → 1..10)
  if (ratingEl.length > 0) {
    const classes = (ratingEl.attr('class') || '').split(/\s+/)
    for (const cls of classes) {
      const match = cls.match(/^rated-(\d+)$/)
      if (match) {
        const n = Number.parseInt(match[1], 10)
        if (n >= 1 && n <= 10) return n
      }
    }
  }

  // Current markup: ratings render as star glyphs, e.g.
  // <span class="inline-symbol inline-rating">★★★★½</span>
  const glyphEl = el.find("[class*='inline-rating']").first()
  if (glyphEl.length === 0) return null
  const text = glyphEl.text()
  const filled = (text.match(/★/g) || []).length
  if (filled === 0) return null
  const half = text.includes('½')
  // ★ count (plus 0.5 for ½) → 1..10 scale
  const n = Math.round((Math.min(5, filled) + (half ? 0.5 : 0)) * 2)
  return n >= 1 && n <= 10 ? n : null
}

function parseWatchedDate(_: CheerioAPI, el: cheerio.Cheerio<any>): string | null {
  const dateEl = el.find('.date').first()
  if (dateEl.length > 0) {
    // Prefer an explicit absolute date if present, otherwise use the visible text
    const abs = dateEl.attr('data-absolute-date')
    if (abs) return abs.trim()

    const text = dateEl.text().trim()
    if (text.length > 0) return text
  }

  // Fallback: list pages render dates as <time class="timestamp" datetime="YYYY-MM-DD">
  const timeEl = el.find('time.timestamp').first()
  const datetime = timeEl.attr('datetime')
  if (datetime) return datetime.trim()

  return null
}

/**
 * Phase (a): parse a list page into pending entries (everything except the
 * full-text html), tagged with the stream they came from. `hasElements` is
 * false only when the page has zero `.production-viewing` elements (stream
 * exhausted); short inline reviews are dropped here.
 */
export function parsePage(
  html: string,
  stream: 'popular' | 'newest'
): { entries: PendingReview[]; hasElements: boolean } {
  const $ = cheerio.load(html)

  const reviewElements = $('.production-viewing').toArray()
  if (reviewElements.length === 0) {
    return { entries: [], hasElements: false }
  }

  const entries: PendingReview[] = []
  for (const reviewElement of reviewElements) {
    const el = $(reviewElement)

    const avatarLink = el.find('.avatar').first()
    const authorHref = avatarLink.attr('href') ?? null
    const authorUrl = authorHref ? `${BASE_URL}${authorHref}` : null
    const author = (authorHref?.replace(/\//g, '') || '').trim()

    const bodyText = el.find('.body-text').first()
    const hasCollapsedText = bodyText.find('div.collapsed-text').length > 0
    const fullTextUrl = hasCollapsedText
      ? bodyText.attr('data-full-text-url')
      : null

    // Only collapsed (long-form) reviews are fetched; short inline reviews are skipped.
    if (!fullTextUrl) continue

    entries.push({
      author,
      authorUrl,
      reviewUrl: `${BASE_URL}${fullTextUrl}`,
      rating: parseRating($, el),
      watchedDate: parseWatchedDate($, el),
      stream,
    })
  }

  return { entries, hasElements: true }
}
