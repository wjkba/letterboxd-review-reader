import PQueue from 'p-queue'

export interface ScrapeQueueOptions {
  /** Maximum number of scrape tasks running concurrently. Default: 2 */
  concurrency?: number
}

let queue: PQueue | null = null
const DEFAULT_CONCURRENCY = 2
const inflight = new Map<string, Promise<unknown>>()

function getQueue(): PQueue {
  if (!queue) {
    queue = new PQueue({ concurrency: DEFAULT_CONCURRENCY })
  }
  return queue
}

/**
 * Enqueue a scrape task for the given film slug. If a task for the same slug
 * is already running, return its existing promise (caller awaits the same
 * result/error). When the task completes (resolve or reject), remove the
 * slug from the in-flight map so future enqueues start fresh.
 */
export function enqueueScrape<T>(
  slug: string,
  task: () => Promise<T>,
): Promise<T> {
  const existing = inflight.get(slug)
  if (existing) {
    return existing as Promise<T>
  }

  const promise = getQueue().add(task)
  inflight.set(slug, promise)

  // Clear the dedupe entry on either outcome. Swallow the rejection on the
  // derived chain so we never trigger an unhandledRejection; the original
  // promise still rejects for the caller.
  promise
    .finally(() => {
      inflight.delete(slug)
    })
    .catch(() => {})

  return promise
}

/** Slugs currently being scraped (in-flight). Snapshot, not reactive. */
export function getRunningSlugs(): string[] {
  return [...inflight.keys()]
}

/**
 * Stats about the underlying p-queue.
 *
 * Note: p-queue's `size` is only the tasks waiting to run and its `pending`
 * is the number running. Here `size` is normalized to "everything in the
 * queue" (running + waiting) and `pending` is the waiting count.
 */
export function getQueueStats(): {
  size: number
  pending: number
  isPaused: boolean
} {
  const q = getQueue()
  return {
    size: q.size + q.pending,
    pending: q.size,
    isPaused: q.isPaused,
  }
}

/**
 * For graceful shutdown / testing — clears pending tasks and the dedupe map,
 * then waits for any already-running tasks to finish.
 */
export async function clearQueue(): Promise<void> {
  const q = getQueue()
  q.clear()
  inflight.clear()
  await q.onIdle()
}

/** Configure the queue before first use (no-op if already created). */
export function initQueue(options: ScrapeQueueOptions): void {
  if (queue) return
  queue = new PQueue({
    concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
  })
}

/** Reset the singleton (testing only). */
export function resetQueue(): void {
  queue = null
  inflight.clear()
}
