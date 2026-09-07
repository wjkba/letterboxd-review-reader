import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import type { Review } from '#/shared/api-types'
import { likeReviewFn } from '../server/likes'

function ratingStars(rating: number | null): string | null {
  if (rating === null || Number.isNaN(rating)) return null
  const filled = Math.max(0, Math.min(5, Math.round(rating / 2)))
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}

/**
 * Markers of a whole-document or otherwise poisoned payload (e.g. a stored
 * Cloudflare challenge page). The scraper stores only the `.body-text`
 * fragment, so a row containing any of these predates that fix and must
 * never be injected into the DOM — a full `<html>` blob inside an `<li>`
 * breaks the page layout and hijacks navigation.
 */
const POISONED_HTML_PATTERN = /<html|<!doctype|<script|<style|<meta|<body|cf_chl/i

function isPoisonedHtml(html: string): boolean {
  return POISONED_HTML_PATTERN.test(html)
}

export function ReviewCard({ review }: { review: Review }) {
  const stars = ratingStars(review.rating)
  const header = (
    <>
      {review.authorUrl ? (
          <a
            href={review.authorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-ink-fg underline underline-offset-2 can-hover:no-underline"
          >
            {review.author}
          </a>
      ) : (
        <span className="font-semibold text-ink-fg">{review.author}</span>
      )}
      {stars && <span className="text-ink-fg">{stars}</span>}
      {!stars && review.rating !== null && (
        <span className="text-ink-fg">{review.rating}/10</span>
      )}
    </>
  )

  return (
    <li
      data-review-id={review.id}
      className="border-b border-ink-subtle py-10 first:pt-0 last:border-b-0 last:pb-0"
    >
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">{header}</div>
      {isPoisonedHtml(review.html) ? (
        <p className="text-left font-serif text-base italic text-ink-meta">
          This review's content failed to load — re-fetch the film to repair
          it.
        </p>
      ) : (
        <div
          className="text-left font-serif text-base leading-[1.7] text-ink-fg [&_a]:font-medium [&_a]:text-ink-fg [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-ink-meta [&_blockquote]:pl-4 [&_blockquote]:italic [&_em]:italic [&_p]:mb-4 [&_p]:last:mb-0 [&_strong]:font-bold"
          dangerouslySetInnerHTML={{ __html: review.html }}
        />
      )}
      {(review.reviewUrl || review.viewingId != null) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 text-sm">
          {review.reviewUrl && (
            <a
              href={review.reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-ink-fg underline underline-offset-2 can-hover:no-underline"
            >
              View on Letterboxd →
            </a>
          )}
          <LikeButton review={review} />
        </div>
      )}
    </li>
  )
}

/**
 * Quiet inline like/unlike control for the review footer row. Reviews
 * scraped before like support have no viewing id — they can't be liked, so
 * nothing renders. The click applies optimistically and reverts if the
 * server says no.
 */
function LikeButton({ review }: { review: Review }) {
  const likeReview = useServerFn(likeReviewFn)
  // Tri-state: null = trust review.liked from the DB; true/false = local
  // optimistic override (needed so unlike can render false).
  const [override, setOverride] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (review.viewingId == null) return null

  const liked = override ?? review.liked

  async function onToggle() {
    if (pending) return
    const target = !liked
    setPending(true)
    setError(null)
    setOverride(target)
    try {
      const res = await likeReview({ data: { reviewId: review.id, liked: target } })
      if (res.ok) {
        // Trust the server's word when given; otherwise keep the intent.
        setOverride(res.liked ?? target)
      } else {
        setOverride(null)
        setError(res.error ?? 'Failed to update like')
      }
    } catch (err) {
      setOverride(null)
      setError(err instanceof Error ? err.message : 'Failed to update like')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-pressed={liked}
        disabled={pending}
        onClick={onToggle}
        className="inline-flex min-h-11 items-center gap-1 text-ink-fg underline underline-offset-2 can-hover:no-underline disabled:opacity-50"
      >
        {pending ? (
          '…'
        ) : (
          <>
            <HeartIcon filled={liked} />
            {liked ? 'Liked' : 'Like'}
          </>
        )}
      </button>
      {error && (
        <span aria-live="polite" className="text-red-700">
          {error}
        </span>
      )}
    </>
  )
}

/**
 * Lucide "heart" icon — https://lucide.dev/icons/heart
 * License: ISC (https://lucide.dev/license), © Lucide Contributors.
 * Inline copy so no icon package is needed; outline for neutral, solid
 * fill for the active (liked) state.
 */
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
    </svg>
  )
}
