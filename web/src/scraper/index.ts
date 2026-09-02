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

export interface ScrapeOptions {
  startPage?: number;
  targetReviews?: number;
  maxPages?: number;
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
}

export interface ScrapeResult {
  slug: string;
  reviews: ScrapedReview[];
  pagesScraped: number;
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

  const reviewsUrl = `${BASE_URL}/film/${slug}/reviews/by/activity/`;
  const scrapedReviews: ScrapedReview[] = [];
  let pagesScraped = 0;

  pageLoop: for (let page = startPage; page <= maxPages; page++) {
    // Stop before fetching anything else once the target is reached.
    if (scrapedReviews.length >= targetReviews) break;

    let pageUrl = reviewsUrl;
    if (page > 1) {
      pageUrl = reviewsUrl.replace(/\/$/, `/page/${page}/`);
    }

    const html = await getHTML(pageUrl);
    pagesScraped++;

    const $ = cheerio.load(html);

    const reviewElements = $(".production-viewing").toArray();
    for (const reviewElement of reviewElements) {
      // Skip remaining reviews on this page (and all further pages) once
      // the target is reached — before fetching any full review text.
      if (scrapedReviews.length >= targetReviews) break pageLoop;
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

      const rating = parseRating($, el);
      const watchedDate = parseWatchedDate($, el);

      // Only collapsed (long-form) reviews are fetched; short inline reviews are skipped.
      if (fullTextUrl) {
        const reviewUrl = `${BASE_URL}${fullTextUrl}`;
        const reviewHTML = await getHTML(reviewUrl);

        const review: ScrapedReview = {
          author,
          authorUrl,
          html: reviewHTML,
          reviewUrl,
          rating,
          watchedDate,
        };
        scrapedReviews.push(review);
        await options?.onReview?.(review, scrapedReviews.length);
        await delay(500);
      }
    }
  }

  return {
    slug,
    reviews: scrapedReviews,
    pagesScraped,
  };
}
