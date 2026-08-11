import { useLocalSearchParams } from "expo-router";
import { ReviewReaderScreen } from "../features/review-reader/ReviewReaderScreen";

export default function ReviewsScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const value = Array.isArray(slug) ? slug[0] : slug;
  return <ReviewReaderScreen slug={value ?? ""} />;
}
