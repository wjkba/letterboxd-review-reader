import { gotScraping } from "got-scraping";
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

export interface ReviewLink {
  author: string;
  fullTextUrl: string;
}

export interface Review {
  author: string;
  html: string;
}

export interface ReviewsResponse {
  reviews: Review[];
  startPage: number;
  limit: number;
}

export type SortMode = "popular" | "newest" | "mixed";

export interface ScrapeOptions {
  startPage?: number;
  targetReviews?: number;
  maxPages?: number;
  /** Which Letterboxd reviews list to pull from (default "popular"). */
  sortMode?: SortMode;
  /** Called after each review is scraped (before the inter-request delay). */
  onReview?: (review: ScrapedReview, index: number) => Promise<void> | void;
}

export interface ScrapedReview {
  author: string;
  authorUrl: string | null;
  html: string;
  reviewUrl: string;
  rating: number | null;
  watchedDate: string | null;
  /** Which reviews list this review came from (tagged at parse time). */
  stream?: "popular" | "newest";
}

/** A parsed long-form review entry that has not had its full text fetched yet. */
interface PendingReview {
  author: string;
  authorUrl: string | null;
  reviewUrl: string;
  rating: number | null;
  watchedDate: string | null;
  stream: "popular" | "newest";
}

export interface ScrapeResult {
  slug: string;
  reviews: ScrapedReview[];
  pagesScraped: number;
  sortMode?: SortMode;
}

const BASE_URL = "https://letterboxd.com";

const headerGeneratorOptions = {
  browsers: [{ name: "chrome", minVersion: 120 }],
  devices: ["desktop"],
  operatingSystems: ["macos"],
} as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getHTML(url: string): Promise<string> {
  const response = await gotScraping({
    url,
    headerGeneratorOptions,
    timeout: { request: 30_000 },
    retry: { limit: 3, methods: ["GET"] },
  });
  return response.body;
}

function extractReviewLinks(html: string): ReviewLink[] {
  const reviewLinks: ReviewLink[] = [];
  const $: CheerioAPI = cheerio.load(html);

  $(".production-viewing").each((_i, reviewElement) => {
    const el = $(reviewElement);

    const avatarLink = el.find(".avatar").first();
    const reviewAuthorHref = avatarLink.attr("href");
    // Strip leading/trailing slashes (original stripped all slashes; keep same result for "/user/")
    const reviewAuthor = reviewAuthorHref?.replace(/\//g, "");

    const bodyText = el.find(".body-text").first();
    const hasCollapsedText = bodyText.find("div.collapsed-text").length > 0;
    const fullTextUrl = hasCollapsedText
      ? bodyText.attr("data-full-text-url")
      : null;

    if (fullTextUrl) {
      reviewLinks.push({
        author: reviewAuthor || "",
        fullTextUrl,
      });
    }
  });

  return reviewLinks;
}

async function extractReviews(reviewLinks: ReviewLink[]): Promise<Review[]> {
  const extractedReviews: Review[] = [];

  for (const review of reviewLinks) {
    const reviewHTML = await getHTML(`${BASE_URL}${review.fullTextUrl}`);
    extractedReviews.push({
      author: review.author,
      html: reviewHTML,
    });
    await delay(500);
  }

  return extractedReviews;
}

export async function getReviews(
  filmSlug: string,
  startPage = 1,
  pageCount = 5
): Promise<Review[]> {
  const url = `${BASE_URL}/film/${filmSlug}/reviews/by/activity/`;
  const allReviewLinks: ReviewLink[] = [];

  for (let page = startPage; page <= pageCount; page++) {
    let pageUrl = url;
    if (page > 1) {
      pageUrl = url.replace(/\/$/, `/page/${page}/`);
    }

    const html = await getHTML(pageUrl);
    const reviewLinks = extractReviewLinks(html);
    allReviewLinks.push(...reviewLinks);
  }

  return extractReviews(allReviewLinks);
}

export async function resolveSlug(slugOrTmdbId: string): Promise<string> {
  if (!slugOrTmdbId.startsWith("tmdb/")) {
    return slugOrTmdbId;
  }

  const tmdbId = slugOrTmdbId.replace("tmdb/", "");
  const url = `${BASE_URL}/tmdb/${tmdbId}`;

  const response = await gotScraping({
    url,
    headerGeneratorOptions,
    timeout: { request: 30_000 },
    retry: { limit: 3, methods: ["GET"] },
    followRedirect: true,
  });

  const finalUrl = response.url;
  const match = finalUrl.match(/letterboxd\.com\/film\/([^/]+)/);

  if (match && match[1]) {
    return match[1];
  }

  throw new Error("Could not resolve slug from TMDB ID");
}

function parseRating(_: CheerioAPI, el: cheerio.Cheerio<any>): number | null {
  const ratingEl = el.find(".rating").first();

  // Legacy markup: Letterboxd marked ratings with classes like "rated-8"
  // (0.5-star scale → 1..10)
  if (ratingEl.length > 0) {
    const classes = (ratingEl.attr("class") || "").split(/\s+/);
    for (const cls of classes) {
      const match = cls.match(/^rated-(\d+)$/);
      if (match) {
        const n = Number.parseInt(match[1], 10);
        if (n >= 1 && n <= 10) return n;
      }
    }
  }

  // Current markup: ratings render as star glyphs, e.g.
  // <span class="inline-symbol inline-rating">★★★★½</span>
  const glyphEl = el.find("[class*='inline-rating']").first();
  if (glyphEl.length === 0) return null;
  const text = glyphEl.text();
  const filled = (text.match(/★/g) || []).length;
  if (filled === 0) return null;
  const half = text.includes("½");
  // ★ count (plus 0.5 for ½) → 1..10 scale
  const n = Math.round((Math.min(5, filled) + (half ? 0.5 : 0)) * 2);
  return n >= 1 && n <= 10 ? n : null;
}

function parseWatchedDate(_: CheerioAPI, el: cheerio.Cheerio<any>): string | null {
  const dateEl = el.find(".date").first();
  if (dateEl.length > 0) {
    // Prefer an explicit absolute date if present, otherwise use the visible text
    const abs = dateEl.attr("data-absolute-date");
    if (abs) return abs.trim();

    const text = dateEl.text().trim();
    if (text.length > 0) return text;
  }

  // Fallback: list pages render dates as <time class="timestamp" datetime="YYYY-MM-DD">
  const timeEl = el.find("time.timestamp").first();
  const datetime = timeEl.attr("datetime");
  if (datetime) return datetime.trim();

  return null;
}

export async function scrapeFilmReviews(
  slug: string,
  options?: ScrapeOptions
): Promise<ScrapeResult> {
  const startPage = options?.startPage ?? 1;
  const targetReviews = options?.targetReviews ?? 20;
  const maxPages = options?.maxPages ?? 25;
  const sortMode: SortMode = options?.sortMode ?? "popular";

  // Base list URL per sort mode. `/page/N/` appends (trailing-slash replace)
  // work for both bases: "reviews/" → "reviews/page/2/".
  const popularUrl = `${BASE_URL}/film/${slug}/reviews/by/activity/`;
  const newestUrl = `${BASE_URL}/film/${slug}/reviews/`;

  const scrapedReviews: ScrapedReview[] = [];
  // Dedupe by review URL: in mixed mode the same review can appear on pages
  // of both lists; also guards against repeats across pages of one list.
  const seen = new Set<string>();
  let pagesScraped = 0;

  function pageUrlFor(base: string, page: number): string {
    return page > 1 ? base.replace(/\/$/, `/page/${page}/`) : base;
  }

  /**
   * Phase (a): parse a list page into pending entries (everything except the
   * full-text html), tagged with the stream they came from. `hasElements` is
   * false only when the page has zero `.production-viewing` elements (stream
   * exhausted); short inline reviews are dropped here.
   */
  function parsePage(
    html: string,
    stream: "popular" | "newest"
  ): { entries: PendingReview[]; hasElements: boolean } {
    const $ = cheerio.load(html);

    const reviewElements = $(".production-viewing").toArray();
    if (reviewElements.length === 0) {
      return { entries: [], hasElements: false };
    }

    const entries: PendingReview[] = [];
    for (const reviewElement of reviewElements) {
      const el = $(reviewElement);

      const avatarLink = el.find(".avatar").first();
      const authorHref = avatarLink.attr("href") ?? null;
      const authorUrl = authorHref ? `${BASE_URL}${authorHref}` : null;
      const author = (authorHref?.replace(/\//g, "") || "").trim();

      const bodyText = el.find(".body-text").first();
      const hasCollapsedText = bodyText.find("div.collapsed-text").length > 0;
      const fullTextUrl = hasCollapsedText
        ? bodyText.attr("data-full-text-url")
        : null;

      // Only collapsed (long-form) reviews are fetched; short inline reviews are skipped.
      if (!fullTextUrl) continue;

      entries.push({
        author,
        authorUrl,
        reviewUrl: `${BASE_URL}${fullTextUrl}`,
        rating: parseRating($, el),
        watchedDate: parseWatchedDate($, el),
        stream,
      });
    }

    return { entries, hasElements: true };
  }

  /**
   * Phase (b): process one pending entry — target check, dedupe check
   * (duplicates never fetch full text or consume a fetch slot), fetch,
   * push, callback, delay.
   */
  async function processEntry(entry: PendingReview): Promise<void> {
    // Skip remaining reviews (and all further pages) once the target is
    // reached — before fetching any full review text.
    if (scrapedReviews.length >= targetReviews) return;

    // Duplicate: don't fetch full text, don't push, don't count toward target.
    if (seen.has(entry.reviewUrl)) return;
    seen.add(entry.reviewUrl);

    const reviewHTML = await getHTML(entry.reviewUrl);

    const review: ScrapedReview = {
      author: entry.author,
      authorUrl: entry.authorUrl,
      html: reviewHTML,
      reviewUrl: entry.reviewUrl,
      rating: entry.rating,
      watchedDate: entry.watchedDate,
      stream: entry.stream,
    };
    scrapedReviews.push(review);
    await options?.onReview?.(review, scrapedReviews.length);
    await delay(500);
  }

  /** Process pending entries in order (single-stream page). */
  async function processEntries(entries: PendingReview[]): Promise<void> {
    for (const entry of entries) {
      await processEntry(entry);
    }
  }

  if (sortMode === "mixed") {
    // Review-level interleaving: each round fetches one page per stream
    // (popular page N, newest page N), parses both into pending batches,
    // then processes them round-robin: popular[0], newest[0], popular[1],
    // newest[1], .... When one batch runs dry, the other's remaining entries
    // continue. A stream is exhausted once a page yields zero review
    // elements; maxPages is the total budget across both streams.
    const next: Record<"popular" | "newest", number> = {
      popular: startPage,
      newest: startPage,
    };
    const done: Record<"popular" | "newest", boolean> = {
      popular: false,
      newest: false,
    };

    while (
      pagesScraped < maxPages &&
      scrapedReviews.length < targetReviews &&
      !(done.popular && done.newest)
    ) {
      // Fetch one page per stream, popular first.
      const batches: PendingReview[][] = [];
      for (const stream of ["popular", "newest"] as const) {
        if (done[stream]) continue;
        if (pagesScraped >= maxPages) break;
        if (scrapedReviews.length >= targetReviews) break;

        const base = stream === "popular" ? popularUrl : newestUrl;
        const html = await getHTML(pageUrlFor(base, next[stream]));
        pagesScraped++;
        next[stream]++;

        const parsed = parsePage(html, stream);
        if (!parsed.hasElements) done[stream] = true;
        else batches.push(parsed.entries);
      }

      // Round-robin across the two batches until both are drained
      // (or the target is reached — the while condition guarantees exit even
      // when entries remain in the batches).
      while (
        scrapedReviews.length < targetReviews &&
        batches.some((batch) => batch.length > 0)
      ) {
        for (const batch of batches) {
          if (scrapedReviews.length >= targetReviews) break;
          const entry = batch.shift();
          if (entry) await processEntry(entry);
        }
      }
    }
  } else {
    // Single stream: the mode's base list, pages in order.
    const base = sortMode === "newest" ? newestUrl : popularUrl;
    const stream: "popular" | "newest" =
      sortMode === "newest" ? "newest" : "popular";

    for (let page = startPage; page <= maxPages; page++) {
      // Stop before fetching anything else once the target is reached.
      if (scrapedReviews.length >= targetReviews) break;

      const html = await getHTML(pageUrlFor(base, page));
      pagesScraped++;

      await processEntries(parsePage(html, stream).entries);
    }
  }

  return {
    slug,
    reviews: scrapedReviews,
    pagesScraped,
    sortMode,
  };
}
