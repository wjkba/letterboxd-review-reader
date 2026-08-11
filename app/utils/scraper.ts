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

function hasNextListingPage(html: string): boolean {
  const root = parse(html);
  // Letterboxd's review paginator is the `.pagination` block (with the
  // optional `.paginate-pages` inner block). Do not let unrelated site-wide
  // navigation links prove that the review listing has another page.
  const paginators = root.querySelectorAll(".pagination");
  return paginators.some((paginator) => {
    const pages = paginator.querySelector(".paginate-pages") || paginator;
    return pages.querySelectorAll("a").some((link) => {
    const classes = link.getAttribute("class")?.split(/\s+/) ?? [];
    return Boolean(link.getAttribute("href")) &&
      (classes.includes("next") || classes.includes("paginate-next"));
    });
  });
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
  let foundEligibleReview = false;
  const defensivePageLimit = Math.max(pageCount, 1) + 100;

  for (let page = startPage; page < startPage + defensivePageLimit; page++) {
    let pageUrl = url;
    if (page > 1) {
      pageUrl = url.replace(/\/$/, `/page/${page}/`);
    }

    const html = await getHTML(pageUrl);
    const reviewLinks = extractReviewLinks(html);
    currentPage = page;
    allReviewLinks.push(...reviewLinks);
    foundEligibleReview ||= reviewLinks.length > 0;
    hasMore = hasNextListingPage(html);
    // Empty listing pages can still contain a Next link (for example when
    // all reviews on that page lack a full-text endpoint). Keep walking until
    // we find usable reviews or the listing itself reaches its end. Once a
    // usable page is found, honor the requested batch size.
    if (!hasMore || (foundEligibleReview && page >= startPage + pageCount - 1)) break;
  }
  if (currentPage >= startPage + defensivePageLimit - 1) hasMore = false;

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
