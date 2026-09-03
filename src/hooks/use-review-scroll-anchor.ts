import { useEffect, useRef, type RefObject } from 'react'
import type { Review } from '#/shared/api-types'

/**
 * Review-anchored scroll restoration.
 *
 * While the user scrolls a film's reviews, we remember an "anchor": the
 * review straddling the viewport top plus the pixel offset between its top
 * edge and the viewport top. On the next visit we wait (via rAF polling)
 * until that review element exists in the DOM, then scroll so it lands back
 * at the same offset. Anchors for every film live under a single
 * localStorage key (`film-scroll:anchor`) as `{ [slug]: anchor }` to keep
 * storage bounded.
 *
 * All localStorage access happens inside effects/handlers, so this is
 * SSR/hydration-safe.
 */

const SCROLL_ANCHOR_KEY = 'film-scroll:anchor'
const SAVE_DEBOUNCE_MS = 200
const RESTORE_FRAME_CAP = 30

export interface ScrollAnchor {
  reviewId: number
  /** Pixels between the review's top edge and the viewport top (positive when scrolled past). */
  offset: number
}

type ScrollAnchorMap = Record<string, ScrollAnchor>

function readAnchorMap(): ScrollAnchorMap {
  try {
    const raw = window.localStorage.getItem(SCROLL_ANCHOR_KEY)
    return raw ? (JSON.parse(raw) as ScrollAnchorMap) : {}
  } catch {
    return {}
  }
}

function writeAnchorMap(map: ScrollAnchorMap): void {
  try {
    window.localStorage.setItem(SCROLL_ANCHOR_KEY, JSON.stringify(map))
  } catch {
    // Storage unavailable/full — scroll anchoring is best-effort.
  }
}

function getScrollAnchor(slug: string): ScrollAnchor | null {
  return readAnchorMap()[slug] ?? null
}

function setScrollAnchor(slug: string, anchor: ScrollAnchor | null): void {
  const map = readAnchorMap()
  if (anchor === null) {
    if (!(slug in map)) return
    delete map[slug]
  } else {
    map[slug] = anchor
  }
  writeAnchorMap(map)
}

/** Remove the saved anchor for a film (used when the end of the list is reached). */
export function clearScrollAnchor(slug: string): void {
  if (typeof window === 'undefined') return
  setScrollAnchor(slug, null)
}

function findReviewElement(
  container: HTMLElement | null,
  reviewId: number,
): HTMLElement | null {
  if (!container) return null
  for (const el of container.querySelectorAll<HTMLElement>('[data-review-id]')) {
    if (el.dataset.reviewId === String(reviewId)) return el
  }
  return null
}

/**
 * The review straddling the viewport top: the last one whose top edge is
 * at/above the viewport top, or — when nothing has scrolled past the top
 * edge yet — the topmost partially-visible one.
 */
function computeAnchor(container: HTMLElement): ScrollAnchor | null {
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>('[data-review-id]'),
  )
  if (elements.length === 0) return null

  let anchorEl: HTMLElement | null = null
  for (const el of elements) {
    if (el.getBoundingClientRect().top <= 0) anchorEl = el
    else break
  }
  if (!anchorEl) {
    anchorEl =
      elements.find((el) => el.getBoundingClientRect().bottom > 0) ?? null
  }
  if (!anchorEl) return null

  const reviewId = Number(anchorEl.dataset.reviewId)
  if (Number.isNaN(reviewId)) return null
  const offset = -anchorEl.getBoundingClientRect().top

  // Restoring to the very top of the first review carries no information —
  // drop the anchor instead of keeping a no-op entry.
  if (anchorEl === elements[0] && offset <= 0) return null

  return { reviewId, offset }
}

/**
 * Records the scroll anchor while the user scrolls and restores it once the
 * reviews are in the DOM. Attach `containerRef` to the `<ul>` rendering the
 * review cards.
 */
export function useReviewScrollAnchor({
  slug,
  reviews,
  containerRef,
}: {
  slug: string
  reviews: Review[]
  containerRef: RefObject<HTMLElement | null>
}): void {
  // Suppresses anchor saving until an in-flight restore has landed, so the
  // restore position isn't overwritten by the listener firing mid-scroll.
  const restoringRef = useRef(false)

  // Restore — runs whenever the reviews data identity changes (initial load
  // and polling refreshes).
  useEffect(() => {
    if (reviews.length === 0) return
    const saved = getScrollAnchor(slug)
    if (!saved) return

    const ids = reviews.map((r) => r.id)
    let targetId = saved.reviewId
    if (!ids.includes(targetId)) {
      // The saved review no longer exists (e.g. a rescrape removed it).
      // Fall back to the nearest existing review id order-wise, else skip.
      let nearest: number | null = null
      for (const id of ids) {
        if (
          nearest === null ||
          Math.abs(id - saved.reviewId) < Math.abs(nearest - saved.reviewId)
        ) {
          nearest = id
        }
      }
      if (nearest === null) return
      targetId = nearest
    }

    restoringRef.current = true
    let cancelled = false
    let frames = 0

    const tick = () => {
      if (cancelled) return
      const el = findReviewElement(containerRef.current, targetId)
      if (el) {
        window.scrollTo({
          top: el.getBoundingClientRect().top + window.scrollY - saved.offset,
        })
        if (targetId === ids[0] && saved.offset <= 0) {
          // Restore landed at the top — nothing meaningful to keep.
          clearScrollAnchor(slug)
        }
        restoringRef.current = false
        return
      }
      if (frames++ >= RESTORE_FRAME_CAP) {
        restoringRef.current = false
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    return () => {
      cancelled = true
      restoringRef.current = false
    }
  }, [slug, reviews, containerRef])

  // Save — debounced scroll listener. The DOM is queried at scroll time, so
  // polling-refreshed review elements are picked up automatically.
  useEffect(() => {
    if (reviews.length === 0) return
    let timer: number | undefined

    const onScroll = () => {
      if (restoringRef.current) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (restoringRef.current) return
        const container = containerRef.current
        if (!container) return
        setScrollAnchor(slug, computeAnchor(container))
      }, SAVE_DEBOUNCE_MS)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
    }
  }, [slug, reviews, containerRef])
}
