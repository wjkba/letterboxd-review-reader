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
    const reviewAuthorHref = $(review).find(".avatar").attr("href");
    const reviewAuthor = reviewAuthorHref.replace(/\//g, "");
    console.log("Author " + reviewAuthor);

    const fullTextUrl = $(review)
      .find(".body-text:has(div.collapsed-text)")
      .attr("data-full-text-url");
    console.log(fullTextUrl);

    console.log("====================");
  });
}

main().catch(console.error);
