import type { Review } from '../db/schema'

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
          className="font-semibold hover:underline"
        >
          {review.author}
        </a>
      ) : (
        <span className="font-semibold">{review.author}</span>
      )}
      {stars && <span className="text-yellow-500">{stars}</span>}
      {!stars && review.rating !== null && (
        <span className="text-yellow-500">{review.rating}/10</span>
      )}
      {review.watchedDate && (
        <span className="text-gray-500 dark:text-gray-400">watched {review.watchedDate}</span>
      )}
    </>
  )

  return (
    <li className="rounded border border-gray-200 p-4 dark:border-gray-700">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">{header}</div>
      <div
        className="max-w-none space-y-3 leading-relaxed [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_em]:italic [&_p]:m-0 [&_strong]:font-bold dark:[&_blockquote]:border-gray-600"
        dangerouslySetInnerHTML={{ __html: review.html }}
      />
      {review.reviewUrl && (
        <a
          href={review.reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          View on Letterboxd →
        </a>
      )}
    </li>
  )
}
