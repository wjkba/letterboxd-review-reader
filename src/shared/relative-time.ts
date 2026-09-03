/** Format a unix-epoch millisecond timestamp as a coarse "Nm ago" label. */
export function relativeTime(unixMs: number | null | undefined): string {
  if (!unixMs) return 'never'
  return `${Math.max(0, Math.round((Date.now() - unixMs) / 60000))}m ago`
}
