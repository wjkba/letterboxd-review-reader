import { Link } from '@tanstack/react-router'
import type { Film } from '#/shared/api-types'
import { StatusBadge } from '#/shared/status-badge'
import { relativeTime } from '#/shared/relative-time'

export function FilmCard({ film }: { film: Film }) {
  return (
    <li className="rounded-md border border-stone-200 bg-white px-4 py-3.5 transition-colors hover:border-stone-400">
      <Link to="/films/$slug" params={{ slug: film.slug }} className="block">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-stone-900">{film.title}</h2>
          <StatusBadge status={film.scrapeStatus} />
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
