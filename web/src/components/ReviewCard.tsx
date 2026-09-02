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
          className="font-semibold text-stone-900 hover:underline"
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
    <li className="border-b border-stone-200 py-8 first:pt-0 last:border-b-0 last:pb-0">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">{header}</div>
      <div
        className="text-justify font-serif text-base leading-7 text-stone-800 [&_a]:text-sky-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-stone-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_em]:italic [&_p]:mb-3 [&_p]:last:mb-0 [&_strong]:font-bold"
        dangerouslySetInnerHTML={{ __html: review.html }}
      />
      {review.reviewUrl && (
        <a
          href={review.reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-sm text-sky-700 hover:underline"
        >
          View on Letterboxd →
        </a>
      )}
    </li>
  )
}
