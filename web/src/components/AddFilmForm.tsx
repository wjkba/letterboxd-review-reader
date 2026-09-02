import { useState, type FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import { addFilmFn } from '../server/films'

export function AddFilmForm() {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!slug.trim()) return
    setPending(true)
    setError(null)
    try {
      await addFilmFn({ data: { slug: slug.trim() } })
      setSlug('')
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add film')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mb-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="letterboxd slug, e.g. the-matrix"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          aria-label="Film slug"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add Film'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  )
}
