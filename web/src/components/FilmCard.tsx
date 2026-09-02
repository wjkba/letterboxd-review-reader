import { Link } from '@tanstack/react-router'
import type { Film } from '../db/schema'

const statusClasses: Record<Film['scrapeStatus'], string> = {
  pending: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  scraping: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

export function relativeTime(unixMs: number | null | undefined): string {
  if (!unixMs) return 'never'
  return `${Math.max(0, Math.round((Date.now() - unixMs) / 60000))}m ago`
}

export function FilmCard({ film }: { film: Film }) {
  return (
    <li className="rounded border border-gray-200 p-4 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500">
      <Link to="/films/$slug" params={{ slug: film.slug }} className="block">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{film.title}</h2>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${statusClasses[film.scrapeStatus]}`}
          >
            {film.scrapeStatus}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">/{film.slug}</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {film.reviewCount} review{film.reviewCount === 1 ? '' : 's'} · scraped{' '}
          {relativeTime(film.lastScrapedAt)}
        </p>
      </Link>
    </li>
  )
}
