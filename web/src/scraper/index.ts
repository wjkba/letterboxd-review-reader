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
  pageCount?: number;
  maxReviews?: number;
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

function parseRating($: CheerioAPI, el: cheerio.Cheerio<any>): number | null {
  const ratingEl = el.find(".rating").first();
  if (ratingEl.length === 0) return null;

  // Letterboxd marks ratings with classes like "rated-8" (0.5-star scale → 1..10)
  const classes = (ratingEl.attr("class") || "").split(/\s+/);
  for (const cls of classes) {
    const match = cls.match(/^rated-(\d+)$/);
    if (match) {
      const n = Number.parseInt(match[1], 10);
      if (n >= 1 && n <= 10) return n;
    }
  }
  return null;
}

function parseWatchedDate($: CheerioAPI, el: cheerio.Cheerio<any>): string | null {
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
  const pageCount = options?.pageCount ?? 5;
  const maxReviews = options?.maxReviews ?? 50;

  const reviewsUrl = `${BASE_URL}/film/${slug}/reviews/by/activity/`;
  const scrapedReviews: ScrapedReview[] = [];
  let pagesScraped = 0;

  for (let page = startPage; page <= pageCount; page++) {
    let pageUrl = reviewsUrl;
    if (page > 1) {
      pageUrl = reviewsUrl.replace(/\/$/, `/page/${page}/`);
    }

    const html = await getHTML(pageUrl);
    pagesScraped++;

    const $ = cheerio.load(html);

    const reviewElements = $(".production-viewing").toArray();
    for (const reviewElement of reviewElements) {
      if (scrapedReviews.length >= maxReviews) break;
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

        scrapedReviews.push({
          author,
          authorUrl,
          html: reviewHTML,
          reviewUrl,
          rating,
          watchedDate,
        });
        await delay(500);
      }
    }

    if (scrapedReviews.length >= maxReviews) break;
  }

  return {
    slug,
    reviews: scrapedReviews,
    pagesScraped,
  };
}
