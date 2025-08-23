import axios from "axios";
import * as cheerio from "cheerio";

export interface ReviewLink {
  author: string;
  fullTextUrl: string;
}

export interface ExtractedReview {
  author: string;
  html: string | null;
}

async function getHTML(url: string): Promise<string> {
  const { data: html } = await axios.get(url);
  return html;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractReviewLinks(html: string): ReviewLink[] {
  let reviewLinks: ReviewLink[] = [];

  const $ = cheerio.load(html);
  $(".production-viewing").each((i: number, reviewElement: any) => {
    const reviewAuthorHref = $(reviewElement).find(".avatar").attr("href");
    const reviewAuthor = reviewAuthorHref?.replace(/\//g, "") || "";

    const fullTextUrl = $(reviewElement)
      .find(".body-text:has(div.collapsed-text)")
      .attr("data-full-text-url");

    if (fullTextUrl) {
      const reviewLink: ReviewLink = {
        author: reviewAuthor,
        fullTextUrl,
      };
      reviewLinks.push(reviewLink);
    }
  });
  return reviewLinks;
}

async function extractReviews(
  reviewLinks: ReviewLink[]
): Promise<ExtractedReview[]> {
  let extractedReviews: ExtractedReview[] = [];

  for (const review of reviewLinks) {
    const reviewHTML = await getHTML(
      `https://letterboxd.com${review.fullTextUrl}`
    );

    const $ = cheerio.load(reviewHTML);
    const html = $("body").html();

    const extractedReview: ExtractedReview = {
      author: review.author,
      html,
    };
    extractedReviews.push(extractedReview);

    await delay(2000);
  }

  return extractedReviews;
}

export async function getReviews(filmSlug: string): Promise<ExtractedReview[]> {
  const url = `https://letterboxd.com/film/${filmSlug}/reviews/by/activity/`;
  let allReviewLinks: ReviewLink[] = [];

  for (let page = 1; page <= 5; page++) {
    let pageUrl = url;
    if (page > 1) {
      pageUrl = url.replace(/\/$/, `/page/${page}/`);
    }

    const html = await getHTML(pageUrl);
    const reviewLinks = extractReviewLinks(html);
    allReviewLinks = allReviewLinks.concat(reviewLinks);

    await delay(1000);
  }

  const reviews = await extractReviews(allReviewLinks);
  return reviews;
}
