import { useEffect, useRef, useState, type RefObject } from 'react'
import { useServerFn } from '@tanstack/react-start'
import type { Review } from '#/shared/api-types'
import { updateFilmProgressFn } from '#/server/progress'
import { clearScrollAnchor } from './use-review-scroll-anchor'

/**
 * Read-progress tracking for a film's reviews.
 *
 * An IntersectionObserver (rootMargin trimming the bottom 20% of the
 * viewport, so a review counts once meaningfully visible) watches the review
 * elements and tracks the FURTHEST review seen by list order. The count is
 * monotonic within a visit — loader refreshes from polling never reset it —
 * and is flushed to the server (fire-and-forget, no router.invalidate())
 * on a debounce so scrolling/restore isn't fought by loader refetches.
 *
 * Attach `containerRef` to the `<ul>` rendering the review cards.
 */

const PROGRESS_DEBOUNCE_MS = 500

export function useReadProgress({
  slug,
  reviews,
  reviewsRead,
  containerRef,
}: {
  slug: string
  reviews: Review[]
  reviewsRead: number
  containerRef: RefObject<HTMLElement | null>
}): number {
  const updateProgress = useServerFn(updateFilmProgressFn)

  const [seenCount, setSeenCount] = useState(reviewsRead)
  // Monotonic high-water mark, survives loader refreshes (polling) and
  // effect re-inits within a visit.
  const maxSeenRef = useRef(reviewsRead)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const container = containerRef.current
    if (!container || reviews.length === 0) return

    // Pick up server-side progress that advanced elsewhere (another tab)
    // after a loader refresh — never move backwards, though.
    if (reviewsRead > maxSeenRef.current) {
      maxSeenRef.current = reviewsRead
      setSeenCount(reviewsRead)
    }

    const flush = (value: number) => {
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        // Fire-and-forget: no router.invalidate() here — a loader refetch
        // mid-scroll would fight the scroll position and restore.
        void updateProgress({ data: { slug, reviewsRead: value } }).catch(
          () => {},
        )
        // The server flips status to 'read' when reviewsRead >= reviewCount;
        // once the end of the list is reached there is nothing left to
        // restore, so drop the scroll anchor.
        if (value >= reviews.length) clearScrollAnchor(slug)
      }, PROGRESS_DEBOUNCE_MS)
    }

    // A pending save would have been cancelled by the cleanup below on the
    // previous effect run — re-schedule it so progress isn't dropped when
    // the reviews array identity changes (polling refresh).
    if (maxSeenRef.current > reviewsRead) flush(maxSeenRef.current)

    const indexById = new Map(reviews.map((r, i) => [r.id, i]))
    const observer = new IntersectionObserver(
      (entries) => {
        let furthest = -1
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const id = Number((entry.target as HTMLElement).dataset.reviewId)
          const index = indexById.get(id)
          if (index !== undefined && index > furthest) furthest = index
        }
        if (furthest === -1) return
        const seen = furthest + 1
        if (seen <= maxSeenRef.current) return
        maxSeenRef.current = seen
        setSeenCount(seen)
        flush(seen)
      },
      // A review counts once it is meaningfully visible, i.e. it has
      // entered the top 80% of the viewport.
      { threshold: 0, rootMargin: '0px 0px -20% 0px' },
    )

    for (const el of container.querySelectorAll<HTMLElement>('[data-review-id]')) {
      observer.observe(el)
    }

    return () => {
      observer.disconnect()
      window.clearTimeout(timerRef.current)
    }
  }, [slug, reviews, reviewsRead, containerRef, updateProgress])

  return seenCount
}
