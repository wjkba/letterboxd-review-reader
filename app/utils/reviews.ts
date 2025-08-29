import AsyncStorage from "@react-native-async-storage/async-storage";
import { Review } from "./api";

export async function saveFilmReview(slug: string, reviews: Review[]) {
  const filmReview = {
    slug,
    reviews,
  };
  await AsyncStorage.setItem(`filmReview_${slug}`, JSON.stringify(filmReview));
}
