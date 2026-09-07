import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { MdSettings } from 'react-icons/md'
import { listFilmsFn } from '../server/films'
import { AddFilmForm } from '../components/AddFilmForm'
import { FilmCard } from '../components/FilmCard'
import { usePollingWhile } from '#/hooks/use-polling'
import type { Film } from '#/shared/api-types'

export const Route = createFileRoute('/')({
  loader: async () => {
    const films = await listFilmsFn()
    return { films }
  },
  component: IndexPage,
})

/** How many "Already read" films show before the "Show all" toggle. */
const READ_PREVIEW_COUNT = 3

/** Most recently active first: last scrape, falling back to when added. */
function byLastActivity(a: Film, b: Film) {
  return (b.lastScrapedAt ?? b.addedAt) - (a.lastScrapedAt ?? a.addedAt)
}

function IndexPage() {
  const { films } = Route.useLoaderData()
  const isScraping = films.some((film) => film.scrapeStatus === 'scraping')
  const [showAllRead, setShowAllRead] = useState(false)

  // Live progress: re-run the loader while any film is being scraped so
  // status badges and review counts update without a manual refresh.
  usePollingWhile(isScraping, 3000)

  const inbox = films
    .filter((film) => film.readStatus !== 'read')
    .sort(byLastActivity)
  const read = films
    .filter((film) => film.readStatus === 'read')
    .sort(byLastActivity)
  const visibleRead = showAllRead ? read : read.slice(0, READ_PREVIEW_COUNT)

  return (
    <main>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink-fg">
            Letterboxd Reviews
          </h1>
          <p className="mt-1 text-sm text-ink-meta">
            Add a film to read its Letterboxd reviews.
          </p>
        </div>
        <Link
          to="/settings"
          aria-label="Settings"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-ink-fg"
        >
          <MdSettings size={20} aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-6">
        <AddFilmForm />
      </div>
      {films.length === 0 ? (
        <p className="mt-10 text-sm text-ink-meta">
          No films yet. Add one above.
        </p>
      ) : (
        <>
          <section aria-labelledby="inbox-heading">
            <div className="mb-4 mt-10 flex items-center gap-2">
              <h2 id="inbox-heading" className="text-sm font-bold text-ink-fg">
                Inbox
              </h2>
              {isScraping && (
                <span
                  aria-live="polite"
                  className="text-xs font-medium text-ink-fg"
                >
                  scraping…
                </span>
              )}
            </div>
            {inbox.length === 0 ? (
              <p className="text-sm text-ink-meta">All caught up.</p>
            ) : (
              <ul className="space-y-2">
                {inbox.map((film) => (
                  <FilmCard key={film.id} film={film} />
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="read-heading">
            <div className="mb-4 mt-10 flex items-center gap-2">
              <h2 id="read-heading" className="text-sm font-bold text-ink-fg">
                Already read
              </h2>
            </div>
            {read.length === 0 ? (
              <p className="text-sm text-ink-meta">Nothing read yet.</p>
            ) : (
              <>
                <ul id="already-read-list" className="space-y-2">
                  {visibleRead.map((film) => (
                    <FilmCard key={film.id} film={film} />
                  ))}
                </ul>
                {read.length > READ_PREVIEW_COUNT && (
                  <button
                    type="button"
                    aria-expanded={showAllRead}
                    aria-controls="already-read-list"
                    onClick={() => setShowAllRead((value) => !value)}
                    className="-mx-2 mt-2 inline-flex min-h-11 items-center px-2 text-sm font-bold text-ink-fg can-hover:bg-ink-hover"
                  >
                    {showAllRead ? 'Show fewer' : `Show all (${read.length})`}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}
    </main>
  )
}
