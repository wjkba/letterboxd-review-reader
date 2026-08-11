import { createMMKV } from "react-native-mmkv";
import { Review } from "./scraper";
const storage = createMMKV();

export interface CachedFilmReviews {
  slug: string;
  reviews: Review[];
  nextPage: number | null;
  hasMore: boolean;
  updatedAt: string;
  cacheVersion: number;
}

const CACHE_VERSION = 2;

export interface ReviewCachePagination {
  nextPage: number | null;
  hasMore: boolean;
}

export function saveFilmReviews(
  slug: string,
  reviews: Review[],
  pagination: ReviewCachePagination = { nextPage: null, hasMore: true }
): void {
  const filmReview: CachedFilmReviews = {
    slug,
    reviews,
    nextPage: pagination.nextPage,
    hasMore: pagination.hasMore,
    updatedAt: new Date().toISOString(),
    cacheVersion: CACHE_VERSION,
  };
  storage.set(`film_${slug}`, JSON.stringify(filmReview));
}

function isReview(value: unknown): value is Review {
  if (!value || typeof value !== "object") return false;
  const review = value as Partial<Review>;
  return typeof review.author === "string" && typeof review.html === "string";
}

/** Reads the complete cache record, including pagination state. */
export function getFilmReviewsCache(slug: string): CachedFilmReviews | null {
  const localFilmReview = storage.getString(`film_${slug}`);
  if (!localFilmReview) return null;

  try {
    const parsed: unknown = JSON.parse(localFilmReview);
    const rawReviews = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? (parsed as { reviews?: unknown }).reviews
        : undefined;
    if (!Array.isArray(rawReviews)) return null;

    const reviews = rawReviews.filter(isReview);
    const record = parsed && typeof parsed === "object" ? parsed as Partial<CachedFilmReviews> : {};
    const nextPage = Number.isInteger(record.nextPage) && (record.nextPage as number) > 0
      ? (record.nextPage as number)
      : null;
    const isCurrentCache = record.cacheVersion === CACHE_VERSION;
    return {
      slug,
      reviews,
      // Old records may have been marked terminal solely because a page had
      // no eligible links. Re-open those records once under the corrected
      // listing-page cursor semantics; a fresh write upgrades the schema.
      nextPage: isCurrentCache ? nextPage : nextPage ?? (reviews.length ? 2 : 1),
      hasMore: isCurrentCache ? (typeof record.hasMore === "boolean" ? record.hasMore : true) : true,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
      cacheVersion: isCurrentCache ? CACHE_VERSION : Number(record.cacheVersion) || 1,
    };
  } catch {
    return null;
  }
}

/** Reads cached reviews and pagination state (legacy records are normalized). */
export function getLocalFilmReviews(slug: string): CachedFilmReviews | null {
  return getFilmReviewsCache(slug);
}
