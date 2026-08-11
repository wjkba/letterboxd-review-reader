import { useCallback, useEffect, useRef, useState } from "react";
import { ReaderPage } from "../components/ReaderContent";
import { countWords, getBlockFragments, splitAtWordBoundary } from "./htmlPagination";
import { clearReadingPosition, getReadingPosition, reviewFingerprint, saveReadingPosition, type ReadingPosition } from "@/utils/storage";

export type HtmlReview = { author: string; html: string };
export type Measurement = { page: ReaderPage; generation: number; requestId: number };

type Options = {
  documentKey: string;
  canonicalSlug: string | null;
  reviews: HtmlReview[];
  viewportHeight: number;
  contentWidth: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreError: string | null;
  onLoadMore: () => Promise<void> | void;
};

type Anchor = { reviewIndex: number; wordOffset: number };
type SplitSearch = { fragment: string; low: number; high: number; target: number; best: [string, string] | null };
type Job = {
  generation: number;
  reviews: HtmlReview[];
  reviewIndex: number;
  fragmentIndex: number;
  pageInReview: number;
  fragments: string[];
  candidate: string[];
  pages: ReaderPage[];
  split?: SplitSearch;
};

const STATUS_RESERVE = 28;
const PREFETCH_REVIEW_WINDOW = 2;

export function useHtmlPageReader(options: Options) {
  const { documentKey, reviews, viewportHeight, contentWidth, hasMore, isLoadingMore, loadMoreError, onLoadMore, canonicalSlug } = options;
  const [pages, setPages] = useState<ReaderPage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [measurement, setMeasurement] = useState<Measurement>();
  const [layoutVersion, setLayoutVersion] = useState(0);
  const pagesRef = useRef<ReaderPage[]>([]);
  const reviewsRef = useRef(reviews);
  reviewsRef.current = reviews;
  const indexRef = useRef(0);
  const jobRef = useRef<Job | null>(null);
  const generationRef = useRef(0);
  const requestIdRef = useRef(0);
  const acceptedMeasurementRef = useRef<{ generation: number; requestId: number } | null>(null);
  const pendingNextRef = useRef(false);
  const loadRequestedRef = useRef(false);
  const wasLoadingMoreRef = useRef(isLoadingMore);
  const anchorRef = useRef<Anchor | null>(null);
  const resetPendingRef = useRef(false);
  const pendingRestoreRef = useRef<ReadingPosition | null>(null);
  const restoreFetchRequestedRef = useRef(false);
  const commitPositionRef = useRef<(index: number) => void>(() => undefined);

  useEffect(() => {
    void documentKey;
    generationRef.current += 1;
    requestIdRef.current += 1;
    jobRef.current = null;
    pagesRef.current = [];
    indexRef.current = 0;
    acceptedMeasurementRef.current = null;
    pendingNextRef.current = false;
    loadRequestedRef.current = false;
    anchorRef.current = null;
    pendingRestoreRef.current = canonicalSlug ? getReadingPosition(canonicalSlug) : null;
    restoreFetchRequestedRef.current = false;
    resetPendingRef.current = true;
    setPages([]);
    setPageIndex(0);
    setMeasurement(undefined);
  }, [canonicalSlug, documentKey]);

  const publish = useCallback((next: ReaderPage[]) => {
    pagesRef.current = next.slice();
    setPages(pagesRef.current);
    const anchor = anchorRef.current;
    if (anchor) {
      const anchored = findAnchorPage(next, anchor);
      if (anchored >= 0) {
        indexRef.current = anchored;
        setPageIndex(anchored);
        anchorRef.current = null;
      }
    }
    if (pendingNextRef.current && next.length > indexRef.current + 1) {
      pendingNextRef.current = false;
      indexRef.current += 1;
      setPageIndex(indexRef.current);
      commitPositionRef.current(indexRef.current);
    }
  }, []);

  const setCandidate = useCallback((job: Job, page: ReaderPage) => {
    const requestId = ++requestIdRef.current;
    setMeasurement({ page, generation: job.generation, requestId });
  }, []);

  const requestMore = useCallback(() => {
    if (!hasMore || isLoadingMore || loadMoreError || loadRequestedRef.current) return false;
    loadRequestedRef.current = true;
    void onLoadMore();
    return true;
  }, [hasMore, isLoadingMore, loadMoreError, onLoadMore]);

  const startReview = useCallback((job: Job, reviewIndex: number) => {
    const review = job.reviews[reviewIndex];
    if (!review) {
      setMeasurement(undefined);
      return;
    }
    job.reviewIndex = reviewIndex;
    job.fragmentIndex = 0;
    job.pageInReview = 0;
    job.fragments = getBlockFragments(review.html);
    job.candidate = [job.fragments[0] || ""];
    setCandidate(job, makePage(job, review.author, job.candidate[0]));
  }, [setCandidate]);

  const measure = useCallback((height: number, generation: number, requestId: number) => {
    const job = jobRef.current;
    if (!job || job.generation !== generation || generation !== generationRef.current || requestId !== requestIdRef.current) return;
    if (acceptedMeasurementRef.current?.generation === generation && acceptedMeasurementRef.current.requestId === requestId) return;
    acceptedMeasurementRef.current = { generation, requestId };
    const review = job.reviews[job.reviewIndex];
    if (!review || viewportHeight <= STATUS_RESERVE) return;
    const fits = height <= viewportHeight - STATUS_RESERVE;

    if (job.split) {
      const search = job.split;
      const split = splitAtWordBoundary(search.fragment, search.target);
      if (fits && split) { search.best = split; search.low = search.target + 1; }
      else search.high = search.target - 1;
      if (search.low <= search.high) {
        search.target = Math.floor((search.low + search.high) / 2);
        const next = splitAtWordBoundary(search.fragment, search.target);
        if (next) { setCandidate(job, makePage(job, review.author, next[0])); return; }
        search.high = search.target - 1;
      } else if (search.best) {
        const [left, right] = search.best;
        job.fragments.splice(job.fragmentIndex, 1, left, right);
        job.pages.push(makePage(job, review.author, left));
        publish(job.pages);
        job.split = undefined;
        job.fragmentIndex += 1;
        job.pageInReview += 1;
        job.candidate = [right];
        setCandidate(job, makePage(job, review.author, right));
        return;
      }
      job.split = undefined;
    }

    const nextFragmentIndex = job.fragmentIndex + job.candidate.length;
    if (fits && nextFragmentIndex < job.fragments.length) {
      job.candidate.push(job.fragments[nextFragmentIndex]);
      setCandidate(job, makePage(job, review.author, job.candidate.join("")));
      return;
    }
    if (!fits && job.candidate.length > 1) {
      const last = job.candidate.pop()!;
      job.pages.push(makePage(job, review.author, job.candidate.join("")));
      publish(job.pages);
      job.pageInReview += 1;
      job.fragmentIndex += job.candidate.length;
      job.candidate = [last];
      setCandidate(job, makePage(job, review.author, last));
      return;
    }
    if (!fits && countWords(job.candidate[0]) > 1) {
      const total = countWords(job.candidate[0]);
      job.split = { fragment: job.candidate[0], low: 1, high: total - 1, target: Math.ceil(total / 2), best: null };
      const next = splitAtWordBoundary(job.split.fragment, job.split.target);
      if (next) { setCandidate(job, makePage(job, review.author, next[0])); return; }
      job.split = undefined;
    }

    job.pages.push(makePage(job, review.author, job.candidate.join("")));
    publish(job.pages);
    const nextReview = job.reviewIndex + 1;
    if (nextReview < job.reviews.length) { startReview(job, nextReview); return; }
    // A request is only started by an explicit tail tap. Measurement may
    // finish that tap's pending intent, but must never create one itself.
    if (pendingNextRef.current && job.reviewIndex === reviewsRef.current.length - 1) {
      pendingNextRef.current = true;
      requestMore();
    }
    setMeasurement(undefined);
  }, [publish, requestMore, startReview, setCandidate, viewportHeight]);

  // Appends extend the existing job. Already-generated pages are never discarded.
  useEffect(() => {
    if (wasLoadingMoreRef.current && !isLoadingMore) {
      loadRequestedRef.current = false;
      // A saved position may be beyond several batches. Permit the restore
      // lifecycle to request the following batch after each completed fetch.
      restoreFetchRequestedRef.current = false;
    }
    wasLoadingMoreRef.current = isLoadingMore;
  }, [isLoadingMore]);

  useEffect(() => {
    const job = jobRef.current;
    if (!reviews.length) return;
    if (!job) { setLayoutVersion((value) => value + 1); return; }
    if (reviews.length <= job.reviews.length) return;
    job.reviews = reviews;
    if (!measurement && job.reviewIndex + 1 < reviews.length) startReview(job, job.reviewIndex + 1);
  }, [measurement, reviews, startReview]);

  useEffect(() => {
    if (!loadMoreError) return;
    pendingNextRef.current = false;
    loadRequestedRef.current = false;
  }, [loadMoreError]);

  useEffect(() => {
    void layoutVersion;
    void documentKey;
    if (resetPendingRef.current) {
      resetPendingRef.current = false;
      return;
    }
    const currentReviews = reviewsRef.current;
    if (!currentReviews.length || viewportHeight <= 0 || contentWidth <= 0) return;
    const current = pagesRef.current[indexRef.current];
    anchorRef.current = current ? anchorForPage(pagesRef.current, indexRef.current) : null;
    const generation = ++generationRef.current;
    const restore = pendingRestoreRef.current;
    let startIndex = 0;
    if (restore) {
      const match = findReview(currentReviews, restore);
      if (match < 0) {
        // Restoring a later review is the only deliberate non-tap fetch path.
        // It has its own guard and never changes the current visible page.
        if (hasMore && !isLoadingMore && !restoreFetchRequestedRef.current) {
          restoreFetchRequestedRef.current = requestMore();
        }
        if (!hasMore && !isLoadingMore) { if (canonicalSlug) clearReadingPosition(canonicalSlug); pendingRestoreRef.current = null; }
        return;
      }
      startIndex = match;
      anchorRef.current = { reviewIndex: match, wordOffset: Math.min(restore.wordOffset, Math.max(0, countWords(currentReviews[match].html) - 1)) };
      pendingRestoreRef.current = null;
    }
    const job: Job = { generation, reviews: currentReviews, reviewIndex: startIndex, fragmentIndex: 0, pageInReview: 0, fragments: [], candidate: [], pages: [] };
    jobRef.current = job;
    acceptedMeasurementRef.current = null;
    startReview(job, startIndex);
  }, [canonicalSlug, contentWidth, documentKey, hasMore, isLoadingMore, requestMore, startReview, viewportHeight, layoutVersion]);

  const commitPosition = useCallback((index: number) => {
    if (!canonicalSlug) return;
    const page = pagesRef.current[index];
    if (!page) return;
    saveReadingPosition(canonicalSlug, { fingerprint: reviewFingerprint(page.author, reviewsRef.current[page.reviewIndex]?.html ?? page.html), reviewIndexHint: page.reviewIndex, wordOffset: Math.min(anchorForPage(pagesRef.current, index).wordOffset, Math.max(0, countWords(reviewsRef.current[page.reviewIndex]?.html ?? page.html) - 1)) });
  }, [canonicalSlug]);
  commitPositionRef.current = commitPosition;

  const previous = useCallback(() => {
    pendingNextRef.current = false;
    if (indexRef.current > 0) { indexRef.current -= 1; setPageIndex(indexRef.current); commitPosition(indexRef.current); }
  }, [commitPosition]);
  const next = useCallback(() => {
    if (indexRef.current < pagesRef.current.length - 1) {
      pendingNextRef.current = false;
      indexRef.current += 1;
      setPageIndex(indexRef.current);
      commitPosition(indexRef.current);
      const newlyVisible = pagesRef.current[indexRef.current];
      if (newlyVisible && newlyVisible.reviewIndex >= reviewsRef.current.length - PREFETCH_REVIEW_WINDOW) requestMore();
      return;
    }
    if (!pagesRef.current.length && !measurement) return;
    if (loadMoreError || !hasMore || isLoadingMore || loadRequestedRef.current) { pendingNextRef.current = false; return; }
    if (measurement) {
      pendingNextRef.current = true;
      if (jobRef.current && jobRef.current.reviewIndex >= reviewsRef.current.length - PREFETCH_REVIEW_WINDOW) requestMore();
      return;
    }
    pendingNextRef.current = true;
    requestMore();
  }, [commitPosition, hasMore, isLoadingMore, loadMoreError, measurement, requestMore]);

  const invalidateLayout = useCallback(() => setLayoutVersion((value) => value + 1), []);
  const complete = !measurement && jobRef.current?.reviewIndex === reviews.length - 1 && !hasMore && !isLoadingMore;
  return {
    pages, currentPage: pages[pageIndex], pageIndex, measurement,
    onMeasure: measure, onPrevious: previous, onNext: next, invalidateLayout,
    canPrevious: pageIndex > 0,
    canNext: pageIndex < pages.length - 1 || Boolean(measurement) || (pages.length > 0 && !complete && hasMore && !loadMoreError),
    isComplete: Boolean(complete),
  };
}

function makePage(job: Job, author: string, html: string): ReaderPage {
  return { reviewIndex: job.reviewIndex, author, html, pageInReview: job.pageInReview };
}

function anchorForPage(pages: ReaderPage[], index: number): Anchor {
  const page = pages[index];
  return { reviewIndex: page.reviewIndex, wordOffset: pages.slice(0, index).filter((item) => item.reviewIndex === page.reviewIndex).reduce((total, item) => total + countWords(item.html), 0) };
}

function findAnchorPage(pages: ReaderPage[], anchor: Anchor): number {
  let offset = 0;
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (page.reviewIndex !== anchor.reviewIndex) continue;
    const wordCount = countWords(page.html);
    if (offset <= anchor.wordOffset && anchor.wordOffset < offset + wordCount) return index;
    offset += wordCount;
  }
  return -1;
}

function findReview(reviews: HtmlReview[], position: ReadingPosition): number {
  const matches = reviews.map((review, index) => reviewFingerprint(review.author, review.html) === position.fingerprint ? index : -1).filter((index) => index >= 0);
  return matches.sort((a, b) => Math.abs(a - position.reviewIndexHint) - Math.abs(b - position.reviewIndexHint))[0] ?? -1;
}
