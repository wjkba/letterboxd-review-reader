const axios = require("axios");
const cheerio = require("cheerio");

const url =
  "https://letterboxd.com/film/corpus-christi-2019/reviews/by/activity/";

const reviews = {};

async function getHTML() {
  const { data: html } = await axios.get(url);
  return html;
}

async function main() {
  const html = await getHTML();
  const $ = cheerio.load(html);
  $(".production-viewing").each((i, review) => {
    const reviewCollapsedText = $(review).find(".collapsed-text p").text();
    console.log(reviewCollapsedText);
  });
}

main().catch(console.error);
