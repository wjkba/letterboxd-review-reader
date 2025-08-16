const axios = require("axios");
const cheerio = require("cheerio");

const url = "https://letterboxd.com/film/parasite-2019/reviews/by/activity/";

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

    await delay(3000 + Math.random() * 2000);
  }

  return extractedReviews;
}

async function main() {
  const html = await getHTML(url);
  const reviewLinks = extractReviewLinks(html);
  const reviews = await extractReviews(reviewLinks);
  console.log(reviews);
}

main().catch(console.error);
