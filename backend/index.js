const express = require("express");
const cors = require("cors");
const { getReviews } = require("./reviews");
const app = express();
const port = 3000;

app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/reviews/:slug", async (req, res) => {
  const { slug } = req.params;
  const { startPage = 1, limit = 5 } = req.query;

  try {
    const reviews = await getReviews(
      slug,
      parseInt(startPage),
      parseInt(limit)
    );
    const response = { reviews, startPage, limit };
    console.log(response);
    res.json(response);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({
      error: "Failed to fetch reviews",
      message: error.message,
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Letterboxd app listening at http://0.0.0.0:${port}`);
});
