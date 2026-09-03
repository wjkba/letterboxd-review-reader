import { useRef } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { getFilmFn } from '../../server/films'
import { getReviewsFn } from '../../server/reviews'
import type { Film, Review } from '#/shared/api-types'
import { StatusBadge } from '#/shared/status-badge'
import { relativeTime } from '#/shared/relative-time'
import { usePollingWhile } from '#/hooks/use-polling'
import { useReviewScrollAnchor } from '#/hooks/use-review-scroll-anchor'
import { useReadProgress } from '#/hooks/use-read-progress'
import { ReviewCard } from '../../components/ReviewCard'

export const Route = createFileRoute('/films/$slug')({
  loader: async ({ params }) => {
    let film: Film
    let reviews: Review[]
    try {
      ;[film, reviews] = await Promise.all([
        getFilmFn({ data: { slug: params.slug } }),
        getReviewsFn({ data: { slug: params.slug } }),
      ])
    } catch (err) {
      // Film not found (or a lookup failed) — render a friendly state
      // instead of bubbling a 500 to the server.
      return {
        film: null,
        reviews: [],
        notFound: true,
        message: err instanceof Error ? err.message : 'Something went wrong.',
      }
    }
    return { film, reviews, notFound: false, message: null }
  },
  component: FilmPage,
})

type LoaderData = ReturnType<typeof Route.useLoaderData>

function NotFoundState({ message }: { message: string }) {
  return (
    <main>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center text-sm text-ink-fg underline underline-offset-2 can-hover:no-underline"
      >
        ← Back
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Film not found</h1>
      <p className="mt-2 text-ink-meta">{message}</p>
    </main>
  )
}

function FilmPage() {
  const data = Route.useLoaderData() as LoaderData
  const params = Route.useParams()
  const { notFound, message } = data
  const scraping = data.film?.scrapeStatus === 'scraping'

  // While scraping, re-run the loader every 2s — this refreshes the film
  // status and the reviews (including the live reviewCount) in one pass.
  usePollingWhile(scraping, 2000)

  // Review-anchored scroll restore + read-progress tracking. Hooks run
  // unconditionally (before the not-found early return); their effects are
  // no-ops while there are no reviews to work with.
  const listRef = useRef<HTMLUListElement>(null)
  const reviews = data.reviews
  useReviewScrollAnchor({
    slug: params.slug,
    reviews,
    containerRef: listRef,
  })
  const seenCount = useReadProgress({
    slug: params.slug,
    reviews,
    reviewsRead: data.film?.reviewsRead ?? 0,
    containerRef: listRef,
  })

  if (notFound || !data.film) {
    return <NotFoundState message={message ?? `No film with slug "${params.slug}"`} />
  }

  const { film } = data
  const effectivelyRead =
    film.readStatus === 'read' || (reviews.length > 0 && seenCount >= reviews.length)

  return (
    <main>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center text-sm text-ink-fg underline underline-offset-2 can-hover:no-underline"
      >
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{film.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-meta">
        <StatusBadge status={film.scrapeStatus} />
        <span>
          {film.reviewCount} review{film.reviewCount === 1 ? '' : 's'}
        </span>
        {effectivelyRead ? (
          <span>✓ Read</span>
        ) : seenCount > 0 ? (
          <span>
            {seenCount} of {film.reviewCount} read
          </span>
        ) : null}
        <span>scraped {relativeTime(film.lastScrapedAt)}</span>
      </div>
      {film.scrapeError && (
        <p aria-live="assertive" className="mt-2 text-sm text-red-700">
          {film.scrapeError}
        </p>
      )}

      <h2 className="mb-4 mt-10 text-sm font-bold text-ink-fg">Reviews</h2>
      {reviews.length === 0 && film.scrapeStatus === 'scraping' ? (
        <p className="text-sm text-ink-meta">
          Scraping in progress… reviews will appear here shortly.
        </p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-ink-meta">
          {film.scrapeStatus === 'failed' && film.scrapeError
            ? `Scrape failed: ${film.scrapeError}`
            : 'No reviews yet.'}
        </p>
      ) : (
        <ul ref={listRef}>
          {reviews.map((review: Review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </ul>
      )}
    </main>
  )
}
