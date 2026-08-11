import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  fetchReviewsBatch,
  resolveSlug,
  type Review,
  type ReviewsResponse,
} from "@/utils/scraper";
import { getFilmReviewsCache, saveFilmReviews } from "@/utils/reviews";
import { addToHistory } from "@/utils/storage";

export interface ReviewFeedViewModel {
  reviews: Review[];
  isResolving: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  isLoadingMore: boolean;
  loadMoreError: string | null;
  hasMore: boolean;
  resolvedSlug: string | null;
  batchRanges: ReviewBatchRange[];
  loadMore: () => Promise<void>;
  retryLoadMore: () => Promise<void>;
}

export interface ReviewBatchRange { start: number; end: number }

type Batch = Pick<ReviewsResponse, "reviews" | "nextPage" | "hasMore">;
type FeedState = {
  reviews: Review[];
  isResolving: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  isLoadingMore: boolean;
  loadMoreError: string | null;
  hasMore: boolean;
  resolvedSlug: string | null;
  batchRanges: ReviewBatchRange[];
};
type FeedAction =
  | { type: "reset"; resolving: boolean }
  | { type: "initialStart" }
  | { type: "initialSuccess"; batch: Batch; resolvedSlug: string }
  | { type: "initialError"; message: string }
  | { type: "moreStart" }
  | { type: "moreSuccess"; reviews: Review[]; hasMore: boolean; range: ReviewBatchRange }
  | { type: "moreError"; message: string };

const initialState: FeedState = {
  reviews: [], isResolving: false, isLoading: false, errorMessage: null,
  isLoadingMore: false, loadMoreError: null, hasMore: true, resolvedSlug: null, batchRanges: [],
};

function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "reset": return { ...initialState, isResolving: action.resolving };
    case "initialStart": return { ...state, isResolving: false, isLoading: true, errorMessage: null };
    case "initialSuccess": return { ...state, reviews: action.batch.reviews, isResolving: false, isLoading: false, errorMessage: null, hasMore: action.batch.hasMore, resolvedSlug: action.resolvedSlug, batchRanges: action.batch.reviews.length ? [{ start: 0, end: action.batch.reviews.length }] : [] };
    case "initialError": return { ...state, isResolving: false, isLoading: false, errorMessage: action.message };
    case "moreStart": return { ...state, isLoadingMore: true, loadMoreError: null };
    case "moreSuccess": return { ...state, reviews: action.reviews, isLoadingMore: false, loadMoreError: null, hasMore: action.hasMore, batchRanges: [...state.batchRanges, action.range] };
    case "moreError": return { ...state, isLoadingMore: false, loadMoreError: action.message };
  }
}

function normalizeBatch(value: unknown): Batch {
  if (Array.isArray(value)) {
    return { reviews: value.filter(isReview), nextPage: value.length ? 2 : null, hasMore: value.length > 0 };
  }
  const candidate = value && typeof value === "object" ? value as Partial<Batch> : {};
  const reviews = Array.isArray(candidate.reviews) ? candidate.reviews.filter(isReview) : [];
  const hasMore = typeof candidate.hasMore === "boolean" ? candidate.hasMore : reviews.length > 0;
  const nextPage = Number.isInteger(candidate.nextPage) && (candidate.nextPage as number) > 0
    ? candidate.nextPage as number
    : hasMore ? 2 : null;
  return { reviews, nextPage, hasMore };
}

function isReview(value: unknown): value is Review {
  if (!value || typeof value !== "object") return false;
  const review = value as Partial<Review>;
  return typeof review.author === "string" && typeof review.html === "string";
}

export function useReviewFeed(slug?: string): ReviewFeedViewModel {
  const epoch = useRef(0);
  const resolvedSlug = useRef<string | null>(null);
  const nextPage = useRef<number | null>(1);
  const moreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const reviewsRef = useRef<Review[]>([]);
  const [state, dispatch] = useReducer(feedReducer, initialState);

  useEffect(() => {
    const requestEpoch = ++epoch.current;
    resolvedSlug.current = null;
    reviewsRef.current = [];
    dispatch({ type: "reset", resolving: Boolean(slug) });
    loadingMoreRef.current = false;
    nextPage.current = 1;
    moreRef.current = true;
    if (!slug) return;

    void (async () => {
      try {
        let finalSlug = slug;
        try { finalSlug = await resolveSlug(slug); } catch { /* direct slug is a valid fallback */ }
        if (requestEpoch !== epoch.current) return;
        resolvedSlug.current = finalSlug;
        addToHistory(finalSlug);

        const cached = getFilmReviewsCache(finalSlug);
        if (cached) {
          const batch = normalizeBatch(cached);
          reviewsRef.current = batch.reviews;
          nextPage.current = batch.nextPage;
          moreRef.current = batch.hasMore;
          dispatch({ type: "initialSuccess", batch, resolvedSlug: finalSlug });
          return;
        }

        dispatch({ type: "initialStart" });
        const batch = normalizeBatch(await fetchReviewsBatch(finalSlug, 1, 1));
        if (requestEpoch !== epoch.current) return;
        reviewsRef.current = batch.reviews;
        nextPage.current = batch.nextPage;
        moreRef.current = batch.hasMore;
        dispatch({ type: "initialSuccess", batch, resolvedSlug: finalSlug });
        saveFilmReviews(finalSlug, batch.reviews, { nextPage: batch.nextPage, hasMore: batch.hasMore });
      } catch (error) {
        if (requestEpoch === epoch.current) dispatch({ type: "initialError", message: error instanceof Error ? error.message : "Failed to load reviews." });
      } finally {
        // State transitions are published by the success/error actions.
      }
    })();
    return () => { /* epoch invalidates outstanding work */ };
  }, [slug]);

  const loadMore = useCallback(async () => {
    const slug = resolvedSlug.current;
    const page = nextPage.current;
    const requestEpoch = epoch.current;
    if (!slug || page === null || !moreRef.current || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    dispatch({ type: "moreStart" });
    try {
      const batch = normalizeBatch(await fetchReviewsBatch(slug, page, 1));
      if (requestEpoch !== epoch.current) return;
      const merged = [...reviewsRef.current, ...batch.reviews];
      reviewsRef.current = merged;
      nextPage.current = batch.nextPage;
      moreRef.current = batch.hasMore;
      dispatch({ type: "moreSuccess", reviews: merged, hasMore: batch.hasMore, range: { start: reviewsRef.current.length - batch.reviews.length, end: merged.length } });
      saveFilmReviews(slug, merged, { nextPage: batch.nextPage, hasMore: batch.hasMore });
    } catch (error) {
      if (requestEpoch === epoch.current) dispatch({ type: "moreError", message: error instanceof Error ? error.message : "Failed to load more reviews." });
    } finally {
      if (requestEpoch === epoch.current) loadingMoreRef.current = false;
    }
  }, []);

  return { ...state, loadMore, retryLoadMore: loadMore };
}
