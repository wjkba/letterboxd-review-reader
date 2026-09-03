import { createFileRoute, Link } from '@tanstack/react-router'
import { listFilmsFn } from '../server/films'
import { AddFilmForm } from '../components/AddFilmForm'
import { FilmCard } from '../components/FilmCard'
import { usePollingWhile } from '#/hooks/use-polling'

export const Route = createFileRoute('/')({
  loader: async () => {
    const films = await listFilmsFn()
    return { films }
  },
  component: IndexPage,
})

function IndexPage() {
  const { films } = Route.useLoaderData()
  const isScraping = films.some((film) => film.scrapeStatus === 'scraping')

  // Live progress: re-run the loader while any film is being scraped so
  // status badges and review counts update without a manual refresh.
  usePollingWhile(isScraping, 3000)

  return (
    <main>
      <h1 className="text-3xl font-bold tracking-tight text-ink-fg">
        Letterboxd Reviews
      </h1>
      <p className="mt-1 text-sm text-ink-meta">
        Add a film to read its Letterboxd reviews.
      </p>
      <div className="mt-6">
        <AddFilmForm />
      </div>
      <div className="mb-4 mt-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-ink-fg">Recent</h2>
          {isScraping && (
            <span aria-live="polite" className="text-xs font-medium text-ink-fg">
              scraping…
            </span>
          )}
        </div>
        <Link
          to="/settings"
          className="inline-flex min-h-11 items-center text-sm text-ink-fg underline underline-offset-2 can-hover:no-underline"
        >
          Settings
        </Link>
      </div>
      {films.length === 0 ? (
        <p className="text-sm text-ink-meta">No films yet. Add one above.</p>
      ) : (
        <ul className="space-y-2">
          {films.map((film) => (
            <FilmCard key={film.id} film={film} />
          ))}
        </ul>
      )}
    </main>
  )
}
