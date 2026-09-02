import { useEffect } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { getFilmFn } from '../../server/films'
import { getReviewsFn } from '../../server/reviews'
import { getScrapeLogsFn } from '../../server/scrape-logs'
import type { Film, Review, ScrapeLog } from '../../db/schema'
import { ReviewCard } from '../../components/ReviewCard'
import { relativeTime } from '../../components/FilmCard'

const statusClasses: Record<string, string> = {
  pending: 'bg-stone-100 text-stone-600',
  scraping: 'bg-sky-100 text-sky-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-600',
}

const logLevelClasses: Record<ScrapeLog['level'], string> = {
  info: 'text-stone-600',
  warn: 'text-amber-700',
  error: 'text-red-600',
}

export const Route = createFileRoute('/films/$slug')({
  loader: async ({ params }) => {
    let film: Film
    let reviews: Review[]
    let logs: ScrapeLog[]
    try {
      ;[film, reviews, logs] = await Promise.all([
        getFilmFn({ data: { slug: params.slug } }),
        getReviewsFn({ data: { slug: params.slug } }),
        getScrapeLogsFn({ data: { slug: params.slug } }),
      ])
    } catch (err) {
      // Film not found (or a lookup failed) — render a friendly state
      // instead of bubbling a 500 to the server.
      return {
        film: null,
        reviews: [],
        logs: [],
        notFound: true,
        message: err instanceof Error ? err.message : 'Something went wrong.',
      }
    }
    return { film, reviews, logs, notFound: false, message: null }
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

function formatLogTime(unixMs: number): string {
  const d = new Date(unixMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function ScrapeLogFeed({ logs, live }: { logs: ScrapeLog[]; live: boolean }) {
  if (logs.length === 0) {
    return live ? (
      <p className="mt-6 text-sm text-stone-500">Waiting for scraper logs…</p>
    ) : null
  }
  return (
    <section className="mt-6">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-stone-700">
        Scrape log
        {live && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-sky-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
            live
          </span>
        )}
      </h2>
      <ol className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-stone-200 bg-white p-3 font-mono text-xs leading-relaxed">
        {logs.map((log) => (
          <li key={log.id} className="flex gap-2">
            <span className="shrink-0 text-stone-400">
              {formatLogTime(log.createdAt)}
            </span>
            <span className={logLevelClasses[log.level] ?? logLevelClasses.info}>
              {log.message}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function FilmPage() {
  const data = Route.useLoaderData() as LoaderData
  const params = Route.useParams()
  const { notFound, message } = data
  const router = useRouter()
  const scraping = data.film?.scrapeStatus === 'scraping'

  // While scraping, re-run the loader every 4s — this refreshes the film
  // status, the reviews, AND the scrape log feed in one pass.
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

  const { film, reviews, logs } = data

  return (
    <main>
      <Link to="/" className="text-sm text-sky-700 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{film.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-600">
        <span
          className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${statusClasses[film.scrapeStatus]}`}
        >
          {film.scrapeStatus === 'scraping' && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
          )}
          {film.scrapeStatus}
        </span>
        <span>
          {film.reviewCount} review{film.reviewCount === 1 ? '' : 's'}
        </span>
        <span>scraped {relativeTime(film.lastScrapedAt)}</span>
      </div>
      {film.scrapeError && (
        <p className="mt-2 text-sm text-red-600">{film.scrapeError}</p>
      )}

      <ScrapeLogFeed logs={logs} live={scraping} />

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
