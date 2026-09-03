import { useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { Film } from '#/shared/api-types'
import { deleteFilmFn, rescrapeFilmFn } from '#/server/films'
import { setFilmReadStatusFn } from '#/server/progress'

export function FilmCard({ film }: { film: Film }) {
  return (
    <li className="relative rounded-md border border-stone-200 bg-white px-4 py-3.5 transition-colors hover:border-stone-400">
      <Link to="/films/$slug" params={{ slug: film.slug }} className="block">
        <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
          <h2 className="text-base font-semibold text-stone-900">{film.title}</h2>
        </div>
        <p className="mt-2 text-sm text-stone-600">
          {film.reviewCount} review{film.reviewCount === 1 ? '' : 's'}
          {film.readStatus === 'reading' && (
            <>
              {' '}
              · {film.reviewsRead} of {film.reviewCount} read
            </>
          )}
          {film.readStatus === 'read' && <> · Read</>}
        </p>
      </Link>
      <FilmMenu
        slug={film.slug}
        title={film.title}
        scraping={film.scrapeStatus === 'scraping'}
        readStatus={film.readStatus}
      />
    </li>
  )
}

/** Three-dot card menu with Rescrape, read-status toggle and (confirmed) Delete actions. */
function FilmMenu({
  slug,
  title,
  scraping,
  readStatus,
}: {
  slug: string
  title: string
  scraping: boolean
  readStatus: Film['readStatus']
}) {
  const router = useRouter()
  const rescrape = useServerFn(rescrapeFilmFn)
  const remove = useServerFn(deleteFilmFn)
  const markRead = useServerFn(setFilmReadStatusFn)

  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState<
    'rescrape' | 'markRead' | 'delete' | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Close on click outside and on Escape (returning focus to the trigger).
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Reset the confirm/error state whenever the menu closes.
  useEffect(() => {
    if (!open) {
      setConfirming(false)
      setError(null)
    }
  }, [open])

  async function onRescrape() {
    setPending('rescrape')
    setError(null)
    try {
      await rescrape({ data: { slug } })
      setOpen(false)
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rescrape')
    } finally {
      setPending(null)
    }
  }

  async function onMarkRead() {
    setPending('markRead')
    setError(null)
    try {
      await markRead({
        data: { slug, status: readStatus === 'read' ? 'unread' : 'read' },
      })
      setOpen(false)
      await router.invalidate()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update read status',
      )
    } finally {
      setPending(null)
    }
  }

  async function onDelete() {
    setPending('delete')
    setError(null)
    try {
      await remove({ data: { slug } })
      setOpen(false)
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setPending(null)
    }
  }

  const busy = pending !== null

  return (
    <div ref={wrapRef} className="absolute right-2 top-2">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${title}`}
        onClick={() => setOpen((o) => !o)}
        className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus:outline-none focus:ring-2 focus:ring-green-600/30"
      >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          className="h-4 w-4"
        >
          <circle cx="2.5" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13.5" cy="8" r="1.5" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 w-36 rounded-md border border-stone-200 bg-white py-1 shadow-lg shadow-stone-900/5"
        >
          {confirming ? (
            <>
              <p className="px-3 py-1.5 text-xs text-stone-500">
                Delete this film permanently?
              </p>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={onDelete}
                className="block w-full px-3 py-1.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {pending === 'delete' ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="block w-full px-3 py-1.5 text-left text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                disabled={busy || scraping}
                onClick={onRescrape}
                className="block w-full px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                {pending === 'rescrape' ? 'Scraping…' : 'Rescrape'}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={onMarkRead}
                className="block w-full px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                {pending === 'markRead'
                  ? 'Saving…'
                  : readStatus === 'read'
                    ? 'Mark as unread'
                    : 'Mark as read'}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => {
                  setConfirming(true)
                  setError(null)
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </>
          )}
          {error && <p className="px-3 py-1.5 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
