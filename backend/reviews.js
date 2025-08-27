const axios = require("axios");
const cheerio = require("cheerio");

async function getHTML(url) {
  const { data: html } = await axios.get(url);
  return html;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractReviewLinks(html) {
  let reviewLinks = [];

  const $ = cheerio.load(html);
  $(".production-viewing").each((i, reviewElement) => {
    const reviewAuthorHref = $(reviewElement).find(".avatar").attr("href");
    const reviewAuthor = reviewAuthorHref.replace(/\//g, "");

    const fullTextUrl = $(reviewElement)
      .find(".body-text:has(div.collapsed-text)")
      .attr("data-full-text-url");

    if (fullTextUrl) {
      const reviewLink = {
        author: reviewAuthor,
        fullTextUrl,
      };
      reviewLinks.push(reviewLink);
    }
  });
  return reviewLinks;
}

async function extractReviews(reviewLinks) {
  let extractedReviews = [];

  for (const review of reviewLinks) {
    const reviewHTML = await getHTML(
      `https://letterboxd.com${review.fullTextUrl}`
    );

    const $ = cheerio.load(reviewHTML);
    const html = $("body").html();

    const extractedReview = {
      author: review.author,
      html,
    };
    extractedReviews.push(extractedReview);

    await delay(1500);
  }

  return extractedReviews;
}

async function getReviews(filmSlug, startPage = 1, pageCount = 5) {
  const url = `https://letterboxd.com/film/${filmSlug}/reviews/by/activity/`;
  let allReviewLinks = [];

  for (let page = startPage; page <= pageCount; page++) {
    let pageUrl = url;
    if (page > 1) {
      pageUrl = url.replace(/\/$/, `/page/${page}/`);
    }

    const html = await getHTML(pageUrl);
    const reviewLinks = extractReviewLinks(html);
    allReviewLinks = allReviewLinks.concat(reviewLinks);
  }

  const reviews = await extractReviews(allReviewLinks);
  return reviews;
}

module.exports = { getReviews };
