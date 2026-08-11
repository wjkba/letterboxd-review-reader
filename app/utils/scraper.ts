import { parse } from "node-html-parser";

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
  requestedPage: number;
  currentPage: number;
  nextPage: number | null;
  hasMore: boolean;
}

async function getHTML(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  const html = await response.text();
  return html;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractReviewLinks(html: string): ReviewLink[] {
  const reviewLinks: ReviewLink[] = [];
  const root = parse(html);

  const reviewElements = root.querySelectorAll(".production-viewing");

  reviewElements.forEach((reviewElement) => {
    const avatarLink = reviewElement.querySelector(".avatar");
    const reviewAuthorHref = avatarLink?.getAttribute("href");
    const reviewAuthor = reviewAuthorHref?.replace(/\//g, "");

    const bodyText = reviewElement.querySelector(".body-text");
    const hasCollapsedText = bodyText?.querySelector("div.collapsed-text");
    const fullTextUrl = hasCollapsedText
      ? bodyText?.getAttribute("data-full-text-url")
      : null;

    if (fullTextUrl) {
      const reviewLink = {
        author: reviewAuthor || "",
        fullTextUrl,
      };
      reviewLinks.push(reviewLink);
    }
  });

  return reviewLinks;
}

async function extractReviews(reviewLinks: ReviewLink[]): Promise<Review[]> {
  const extractedReviews: Review[] = [];

  for (const review of reviewLinks) {
    const reviewHTML = await getHTML(
      `https://letterboxd.com${review.fullTextUrl}`
    );
    const html = reviewHTML;

    const extractedReview = {
      author: review.author,
      html,
    };
    extractedReviews.push(extractedReview);
    await delay(500);
  }

  return extractedReviews;
}

/** Fetches a consecutive batch of Letterboxd listing pages. */
export async function fetchReviewsBatch(
  filmSlug: string,
  startPage = 1,
  pageCount = 5
): Promise<ReviewsResponse> {
  if (!Number.isInteger(startPage) || startPage < 1) {
    throw new Error("startPage must be a positive integer");
  }
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error("pageCount must be a positive integer");
  }

  const url = `https://letterboxd.com/film/${filmSlug}/reviews/by/activity/`;
  const allReviewLinks: ReviewLink[] = [];
  let currentPage = startPage - 1;
  let hasMore = true;

  for (let page = startPage; page < startPage + pageCount; page++) {
    let pageUrl = url;
    if (page > 1) {
      pageUrl = url.replace(/\/$/, `/page/${page}/`);
    }

    const html = await getHTML(pageUrl);
    const reviewLinks = extractReviewLinks(html);
    currentPage = page;
    if (reviewLinks.length === 0) {
      hasMore = false;
      break;
    }
    allReviewLinks.push(...reviewLinks);
  }

  const reviews = await extractReviews(allReviewLinks);
  return {
    reviews,
    requestedPage: startPage,
    currentPage,
    nextPage: hasMore ? currentPage + 1 : null,
    hasMore,
  };
}

/** @deprecated Use fetchReviewsBatch; retained so existing callers keep compiling. */
export async function getReviews(
  filmSlug: string,
  startPage = 1,
  pageCount = 5
): Promise<ReviewsResponse> {
  return fetchReviewsBatch(filmSlug, startPage, pageCount);
}

export async function resolveSlug(slugOrTmdbId: string): Promise<string> {
  if (!slugOrTmdbId.startsWith("tmdb/")) {
    return slugOrTmdbId;
  }

  const tmdbId = slugOrTmdbId.replace("tmdb/", "");
  const url = `https://letterboxd.com/tmdb/${tmdbId}`;

  const response = await fetch(url, {
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  const finalUrl = response.url;
  const match = finalUrl.match(/letterboxd\.com\/film\/([^/]+)/);

  if (match && match[1]) {
    return match[1];
  }

  throw new Error("Could not resolve slug from TMDB ID");
}
