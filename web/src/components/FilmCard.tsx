import { Link } from '@tanstack/react-router'
import type { Film } from '../db/schema'

const statusClasses: Record<Film['scrapeStatus'], string> = {
  pending: 'bg-stone-100 text-stone-600',
  scraping: 'bg-sky-100 text-sky-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-600',
}

export function relativeTime(unixMs: number | null | undefined): string {
  if (!unixMs) return 'never'
  return `${Math.max(0, Math.round((Date.now() - unixMs) / 60000))}m ago`
}

export function FilmCard({ film }: { film: Film }) {
  return (
    <li className="rounded-md border border-stone-200 bg-white px-4 py-3.5 transition-colors hover:border-stone-400">
      <Link to="/films/$slug" params={{ slug: film.slug }} className="block">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-stone-900">{film.title}</h2>
          <span
            className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${statusClasses[film.scrapeStatus]}`}
          >
            {film.scrapeStatus === 'scraping' && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
            )}
            {film.scrapeStatus}
          </span>
        </div>
        <p className="mt-1 text-sm text-stone-500">/{film.slug}</p>
        <p className="mt-2 text-sm text-stone-600">
          {film.reviewCount} review{film.reviewCount === 1 ? '' : 's'} · scraped{' '}
          {relativeTime(film.lastScrapedAt)}
        </p>
      </Link>
    </li>
  )
}
