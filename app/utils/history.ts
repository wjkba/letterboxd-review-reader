import { createMMKV } from "react-native-mmkv";

const storage = createMMKV();
const HISTORY_KEY = "recent_films";
const MAX_HISTORY = 5;

export function formatSlugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function addToHistory(slug: string) {
  const history = getHistory();
  const filtered = history.filter((s) => s !== slug);
  const newHistory = [slug, ...filtered].slice(0, MAX_HISTORY);
  storage.set(HISTORY_KEY, JSON.stringify(newHistory));
}

export function getHistory(): string[] {
  const stored = storage.getString(HISTORY_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return [];
}
