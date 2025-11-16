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
  startPage: number;
  limit: number;
}

async function getHTML(url: string): Promise<string> {
  const response = await fetch(url);
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
    await delay(1500);
  }

  return extractedReviews;
}

export async function getReviews(
  filmSlug: string,
  startPage = 1,
  pageCount = 5
): Promise<Review[]> {
  const url = `https://letterboxd.com/film/${filmSlug}/reviews/by/activity/`;
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

  const reviews = await extractReviews(allReviewLinks);
  return reviews;
}
