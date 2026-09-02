import { createFileRoute } from '@tanstack/react-router'
import { listFilmsFn } from '../server/films'
import { AddFilmForm } from '../components/AddFilmForm'
import { FilmCard } from '../components/FilmCard'

export const Route = createFileRoute('/')({
  loader: async () => {
    const films = await listFilmsFn()
    return { films }
  },
  component: IndexPage,
})

function IndexPage() {
  const { films } = Route.useLoaderData()

  return (
    <main>
      <h1 className="text-3xl font-bold">Letterboxd Reviews</h1>
      <div className="mt-6">
        <AddFilmForm />
      </div>
      <h2 className="mb-4 text-xl font-semibold">Films</h2>
      {films.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No films yet. Add one above.</p>
      ) : (
        <ul className="space-y-3">
          {films.map((film) => (
            <FilmCard key={film.id} film={film} />
          ))}
        </ul>
      )}
    </main>
  )
}
