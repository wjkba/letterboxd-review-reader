import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'

/**
 * Re-run the router's loaders on an interval while `active` is true.
 * Used to poll for live scrape progress (film status, review counts).
 */
export function usePollingWhile(active: boolean, intervalMs: number): void {
  const router = useRouter()

  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => {
      void router.invalidate()
    }, intervalMs)
    return () => clearInterval(interval)
  }, [router, active, intervalMs])
}
