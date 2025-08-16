const axios = require("axios");
const cheerio = require("cheerio");

const url = "https://letterboxd.com/film/parasite-2019/reviews/by/activity/";

let result = [];

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
    console.log("Author " + reviewAuthor);

    const fullTextUrl = $(reviewElement)
      .find(".body-text:has(div.collapsed-text)")
      .attr("data-full-text-url");
    console.log(fullTextUrl);

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

async function main() {
  const html = await getHTML(url);
  const reviews = extractReviewLinks(html);
  console.log(reviews);

  for (const review of reviews) {
    const reviewHTML = await getHTML(
      `https://letterboxd.com${review.fullTextUrl}`
    );

    const $ = cheerio.load(reviewHTML);
    const text = $("p").text();
    const newReview = {
      author: review.author,
      text,
    };
    result.push(newReview);

    await delay(3000 + Math.random() * 2000);
  }

  console.log(result);
}

main().catch(console.error);
