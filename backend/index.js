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

  try {
    const reviews = await getReviews(slug);
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({
      error: "Failed to fetch reviews",
      message: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Letterboxd app listening on port ${port}`);
});
