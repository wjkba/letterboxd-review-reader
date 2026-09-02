import { useEffect } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { getFilmFn } from '../../server/films'
import { getReviewsFn } from '../../server/reviews'
import type { Film, Review } from '../../db/schema'
import { ReviewCard } from '../../components/ReviewCard'
import { relativeTime } from '../../components/FilmCard'

const statusClasses: Record<string, string> = {
  pending: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  scraping: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

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
      // Film not found (or reviews lookup failed) — render a friendly state
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
      <Link to="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← Back
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Film not found</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">{message}</p>
    </main>
  )
}

function FilmPage() {
  const data = Route.useLoaderData() as LoaderData
  const params = Route.useParams()
  const { notFound, message } = data
  const router = useRouter()
  const scraping = data.film?.scrapeStatus === 'scraping'

  useEffect(() => {
    if (!scraping) return
    const interval = setInterval(() => {
      void router.invalidate()
    }, 4000)
    return () => clearInterval(interval)
  }, [router, scraping])

  if (notFound || !data.film) {
    return <NotFoundState message={message ?? `No film with slug "${params.slug}"`} />
  }

  const { film, reviews } = data

  return (
    <main>
      <Link to="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{film.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${statusClasses[film.scrapeStatus]}`}
        >
          {film.scrapeStatus}
        </span>
        <span>
          {film.reviewCount} review{film.reviewCount === 1 ? '' : 's'}
        </span>
        <span>scraped {relativeTime(film.lastScrapedAt)}</span>
      </div>
      {film.scrapeError && <p className="mt-2 text-sm text-red-500">{film.scrapeError}</p>}

      <h2 className="mt-8 mb-4 text-xl font-semibold">Reviews</h2>
      {reviews.length === 0 && film.scrapeStatus === 'scraping' ? (
        <p className="text-gray-500 dark:text-gray-400">
          Scraping in progress… reviews will appear here shortly.
        </p>
      ) : reviews.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          {film.scrapeStatus === 'failed' && film.scrapeError
            ? `Scrape failed: ${film.scrapeError}`
            : 'No reviews yet.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review: Review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </ul>
      )}
    </main>
  )
}

