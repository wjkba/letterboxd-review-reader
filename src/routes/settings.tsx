import { useEffect, useRef, useState } from 'react'
import { MdArrowBack } from 'react-icons/md'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import {
  getSortModeFn,
  getTargetReviewsFn,
  saveSortModeFn,
  saveTargetReviewsFn,
} from '../server/settings'
import type { SortMode } from '#/shared/sort-mode'

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
  const lastSaved = useRef({ value: String(targetReviews), mode })

  // Auto-save: debounced save whenever the settings change, no button needed.
  useEffect(() => {
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return

    const nextValue = String(parsed)
    if (nextValue === lastSaved.current.value && mode === lastSaved.current.mode) {
      return
    }

    let cancelled = false
    setSaved(false)
    const timer = setTimeout(async () => {
      setPending(true)
      setError(null)
      try {
        const clamped = await saveTargetReviewsFn({ data: { value: parsed } })
        const savedMode = await saveSortModeFn({ data: { value: mode } })
        if (cancelled) return
        lastSaved.current = { value: String(clamped), mode: savedMode }
        setValue(String(clamped))
        setMode(savedMode)
        setSaved(true)
        await router.invalidate()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to save')
        }
      } finally {
        if (!cancelled) setPending(false)
      }
    }, 600)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value, mode, router])

  return (
    <main>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-fg underline underline-offset-2 can-hover:no-underline"
      >
        <MdArrowBack size={16} aria-hidden="true" className="-mt-px" />
        Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink-fg">
        Settings
      </h1>
      <p className="mt-1 text-sm text-ink-meta">
        Configure how reviews are scraped from Letterboxd.
      </p>
      <div className="mt-8 max-w-md">
        <fieldset className="border-0 p-0">
          <legend className="block text-sm font-medium text-ink-fg">
            Review sort order
          </legend>
          <div className="mt-2 space-y-2">
            {SORT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center gap-2"
              >
                <input
                  type="radio"
                  name="sort-mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                  className="h-4 w-4 shrink-0 accent-ink-fg"
                />
                <span>
                  <span className="block text-sm text-ink-fg">
                    {option.label}
                  </span>
                  <span className="block text-xs text-ink-meta">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label
          htmlFor="target-reviews"
          className="mt-6 block text-sm font-medium text-ink-fg"
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
            onChange={(e) => setValue(e.target.value)}
            className="min-h-11 w-28 border border-ink-border bg-ink-bg px-3 py-2 text-sm text-ink-fg"
          />
        </div>
        {/* Inline status instead of toasts; survives the render delay (§5). */}
        {pending && !error && (
          <p aria-live="polite" className="mt-2 text-sm text-ink-meta">
            Saving…
          </p>
        )}
        {saved && !error && !pending && (
          <p aria-live="polite" className="mt-2 text-sm text-ink-fg">
            ✓ Saved
          </p>
        )}
        {error && (
          <p aria-live="assertive" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
