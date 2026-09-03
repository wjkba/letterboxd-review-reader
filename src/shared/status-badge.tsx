import type { Film } from './api-types'

const statusClasses: Record<Film['scrapeStatus'], string> = {
  pending: 'bg-stone-100 text-stone-600',
  scraping: 'bg-sky-100 text-sky-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-600',
}

/** Colored pill showing a film's scrape status, with a pulse dot while scraping. */
export function StatusBadge({ status }: { status: Film['scrapeStatus'] }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${statusClasses[status]}`}
    >
      {status === 'scraping' && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
      )}
      {status}
    </span>
  )
}
