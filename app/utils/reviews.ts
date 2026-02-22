import { createMMKV } from "react-native-mmkv";
import { Review } from "./api";
const storage = createMMKV();

export function saveFilmReviews(slug: string, reviews: Review[]) {
  const filmReview = {
    slug,
    reviews,
    updatedAt: new Date().toISOString(),
  };
  storage.set(`film_${slug}`, JSON.stringify(filmReview));
}

export function getLocalFilmReviews(slug: string) {
  const localFilmReview = storage.getString(`film_${slug}`);
  if (localFilmReview) {
    const { reviews } = JSON.parse(localFilmReview);
    return reviews;
  }
  return null;
}
