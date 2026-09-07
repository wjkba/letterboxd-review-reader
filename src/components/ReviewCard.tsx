import { useState } from 'react'
import {
  MdArrowOutward,
  MdFavorite,
  MdFavoriteBorder,
  MdStar,
  MdStarBorder,
  MdStarHalf,
} from 'react-icons/md'
import { useServerFn } from '@tanstack/react-start'
import type { Review } from '#/shared/api-types'
import { likeReviewFn } from '../server/likes'

/** One-based star slots; the fixed five-star row keys off these values. */
const STAR_SLOTS = [1, 2, 3, 4, 5]

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null || Number.isNaN(rating)) return null
  const stars = Math.max(0, Math.min(5, rating / 2))
  return (
    <span className="-mt-px inline-flex items-center gap-0.5 text-ink-fg">
      <span aria-hidden="true" className="flex items-center gap-0.5">
        {STAR_SLOTS.map((slot) => {
          const fill = stars - (slot - 1)
          if (fill >= 1) {
            return <MdStar key={slot} size={16} aria-hidden="true" />
          }
          if (fill >= 0.5) {
            return <MdStarHalf key={slot} size={16} aria-hidden="true" />
          }
          return <MdStarBorder key={slot} size={16} aria-hidden="true" />
        })}
      </span>
      <span className="sr-only">{rating} out of 10</span>
    </span>
  )
}

const POISONED_HTML_PATTERN = /<html|<!doctype|<script|<style|<meta|<body|cf_chl/i

function isPoisonedHtml(html: string): boolean {
  return POISONED_HTML_PATTERN.test(html)
}

export function ReviewCard({ review }: { review: Review }) {
  const hasStars = review.rating !== null && !Number.isNaN(review.rating)
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
      {hasStars && <StarRating rating={review.rating} />}
      {!hasStars && review.rating !== null && (
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
              className="inline-flex min-h-11 items-center gap-1.5 text-ink-fg underline underline-offset-2 can-hover:no-underline"
            >
              <MdArrowOutward size={16} aria-hidden="true" className="-mt-px" />
              View on Letterboxd
            </a>
          )}
          <LikeButton review={review} />
        </div>
      )}
    </li>
  )
}

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
        className="inline-flex min-h-11 items-center gap-1.5 text-ink-fg underline underline-offset-2 can-hover:no-underline disabled:opacity-50"
      >
        {pending ? (
          '…'
        ) : (
          <>
            {liked ? (
              <MdFavorite size={16} aria-hidden="true" className="-mt-px" />
            ) : (
              <MdFavoriteBorder size={16} aria-hidden="true" className="-mt-px" />
            )}
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

