import type { Film } from './api-types'

/*
 * Grayscale-legible states (EINK_UI_STYLE_GUIDE §3, §6): every badge is
 * distinguished by border style/weight or an inverted fill, and the text
 * label always carries the state — never color, never motion.
 */
const statusClasses: Record<Film['scrapeStatus'], string> = {
  // Queued, not started: light dashed line.
  pending: 'border border-dashed border-ink-meta text-ink-meta',
  // In flight: solid rule + bold text, no pulse dot (§7 motion ban).
  scraping: 'border border-ink-border font-bold text-ink-fg',
  // Done: inverted fill (the §6 "selected" idiom reads as "settled").
  completed: 'bg-ink-fg text-ink-bg',
  // Failed: heaviest border in grayscale; the label carries the danger.
  failed: 'border-2 border-ink-border font-bold text-ink-fg',
}

export function StatusBadge({ status }: { status: Film['scrapeStatus'] }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${statusClasses[status]}`}
    >
      {status}
    </span>
  )
}
