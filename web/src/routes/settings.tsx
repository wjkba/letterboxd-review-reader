import { useState, type FormEvent } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getTargetReviewsFn, saveTargetReviewsFn } from '../server/settings'

export const Route = createFileRoute('/settings')({
  loader: async () => {
    const targetReviews = await getTargetReviewsFn()
    return { targetReviews }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { targetReviews } = Route.useLoaderData()
  const router = useRouter()

  const [value, setValue] = useState(String(targetReviews))
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) {
      setError('Enter a number between 1 and 100')
      return
    }
    setPending(true)
    setError(null)
    setSaved(false)
    try {
      const clamped = await saveTargetReviewsFn({ data: { value: parsed } })
      setValue(String(clamped))
      setSaved(true)
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setPending(false)
    }
  }

  return (
    <main>
      <h1 className="text-3xl font-bold tracking-tight text-stone-900">
        Settings
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        Configure how reviews are scraped from Letterboxd.
      </p>
      <form onSubmit={onSubmit} className="mt-8 max-w-md">
        <label
          htmlFor="target-reviews"
          className="block text-sm font-medium text-stone-700"
        >
          Long-form reviews to fetch per film
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="target-reviews"
            type="number"
            min={1}
            max={100}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setSaved(false)
            }}
            className="w-24 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-green-600/30"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
        {saved && !error && (
          <p className="mt-2 text-sm text-green-700">Saved</p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>
    </main>
  )
}
