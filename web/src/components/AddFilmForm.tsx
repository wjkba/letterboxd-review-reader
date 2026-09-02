import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { addFilmFn } from '../server/films'

export function AddFilmForm() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!slug.trim()) return
    setPending(true)
    setError(null)
    try {
      const film = await addFilmFn({ data: { slug: slug.trim() } })
      setSlug('')
      // Land on the film page so the user sees scraping progress + logs live.
      await navigate({ to: '/films/$slug', params: { slug: film.slug } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add film')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mb-2">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="letterboxd slug, e.g. the-matrix"
          className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/30"
          aria-label="Film slug"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add Film'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
