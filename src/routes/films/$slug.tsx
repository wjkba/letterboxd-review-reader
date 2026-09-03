import { Link, createFileRoute } from '@tanstack/react-router'
import { getFilmFn } from '../../server/films'
import { getReviewsFn } from '../../server/reviews'
import type { Film, Review } from '#/shared/api-types'
import { StatusBadge } from '#/shared/status-badge'
import { relativeTime } from '#/shared/relative-time'
import { usePollingWhile } from '#/hooks/use-polling'
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
      <Link to="/" className="text-sm text-sky-700 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Film not found</h1>
      <p className="mt-2 text-stone-500">{message}</p>
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

  if (notFound || !data.film) {
    return <NotFoundState message={message ?? `No film with slug "${params.slug}"`} />
  }

  const { film, reviews } = data

  return (
    <main>
      <Link to="/" className="text-sm text-sky-700 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{film.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-600">
        <StatusBadge status={film.scrapeStatus} />
        <span>
          {film.reviewCount} review{film.reviewCount === 1 ? '' : 's'}
        </span>
        <span>scraped {relativeTime(film.lastScrapedAt)}</span>
      </div>
      {film.scrapeError && (
        <p className="mt-2 text-sm text-red-600">{film.scrapeError}</p>
      )}

      <h2 className="mb-4 mt-10 text-sm font-bold text-stone-700">Reviews</h2>
      {reviews.length === 0 && film.scrapeStatus === 'scraping' ? (
        <p className="text-sm text-stone-500">
          Scraping in progress… reviews will appear here shortly.
        </p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-stone-500">
          {film.scrapeStatus === 'failed' && film.scrapeError
            ? `Scrape failed: ${film.scrapeError}`
            : 'No reviews yet.'}
        </p>
      ) : (
        <ul>
          {reviews.map((review: Review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </ul>
      )}
    </main>
  )
}
