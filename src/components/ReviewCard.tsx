import type { Review } from '#/shared/api-types'

function ratingStars(rating: number | null): string | null {
  if (rating === null || Number.isNaN(rating)) return null
  const filled = Math.max(0, Math.min(5, Math.round(rating / 2)))
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
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
            className="font-semibold text-stone-900 underline hover:no-underline"
          >
            {review.author}
          </a>
      ) : (
        <span className="font-semibold text-stone-900">{review.author}</span>
      )}
      {stars && <span className="text-amber-500">{stars}</span>}
      {!stars && review.rating !== null && (
        <span className="text-amber-500">{review.rating}/10</span>
      )}
    </>
  )

  return (
    <li
      data-review-id={review.id}
      className="border-b border-stone-300 py-10 first:pt-0 last:border-b-0 last:pb-0"
    >
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">{header}</div>
      <div
        className="text-left font-serif text-base leading-[1.7] text-stone-900 [&_a]:font-medium [&_a]:text-stone-900 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-stone-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_em]:italic [&_p]:mb-4 [&_p]:last:mb-0 [&_strong]:font-bold"
        dangerouslySetInnerHTML={{ __html: review.html }}
      />
      {review.reviewUrl && (
        <a
          href={review.reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-sm text-sky-700 underline hover:no-underline"
        >
          View on Letterboxd →
        </a>
      )}
    </li>
  )
}
