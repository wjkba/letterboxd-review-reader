import { useState, type FormEvent } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getSortModeFn,
  getTargetReviewsFn,
  saveSortModeFn,
  saveTargetReviewsFn,
} from '../server/settings'
import type { SortMode } from '../scraper'

const SORT_OPTIONS: Array<{
  value: SortMode
  label: string
  description: string
}> = [
  {
    value: 'popular',
    label: 'Popular',
    description: 'Most-liked long reviews',
  },
  {
    value: 'newest',
    label: 'Newest',
    description: 'Most recent long reviews',
  },
  {
    value: 'mixed',
    label: 'Mixed',
    description: 'Alternate pages from both lists for a balanced spread',
  },
]

export const Route = createFileRoute('/settings')({
  loader: async () => {
    const [targetReviews, sortMode] = await Promise.all([
      getTargetReviewsFn(),
      getSortModeFn(),
    ])
    return { targetReviews, sortMode }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { targetReviews, sortMode } = Route.useLoaderData()
  const router = useRouter()

  const [value, setValue] = useState(String(targetReviews))
  const [mode, setMode] = useState<SortMode>(sortMode)
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
      const savedMode = await saveSortModeFn({ data: { value: mode } })
      setValue(String(clamped))
      setMode(savedMode)
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
        <fieldset className="border-0 p-0">
          <legend className="block text-sm font-medium text-stone-700">
            Review sort order
          </legend>
          <div className="mt-2 space-y-2">
            {SORT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2"
              >
                <input
                  type="radio"
                  name="sort-mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => {
                    setMode(option.value)
                    setSaved(false)
                  }}
                  className="mt-1 accent-green-600"
                />
                <span>
                  <span className="block text-sm text-stone-900">
                    {option.label}
                  </span>
                  <span className="block text-xs text-stone-500">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label
          htmlFor="target-reviews"
          className="mt-6 block text-sm font-medium text-stone-700"
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
