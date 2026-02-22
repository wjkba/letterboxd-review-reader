import { createMMKV } from "react-native-mmkv";

const storage = createMMKV();

export const STORAGE_KEYS = {
  TMDB_ACCESS_TOKEN: "tmdb_access_token",
  RECENT_FILMS: "recent_films",
} as const;

export function getStoredTmdbToken(): string | undefined {
  return storage.getString(STORAGE_KEYS.TMDB_ACCESS_TOKEN);
}

export function setStoredTmdbToken(token: string): void {
  storage.set(STORAGE_KEYS.TMDB_ACCESS_TOKEN, token);
}

export function getHistory(): string[] {
  const stored = storage.getString(STORAGE_KEYS.RECENT_FILMS);
  if (stored) {
    return JSON.parse(stored);
  }
  return [];
}

export function addToHistory(slug: string) {
  const history = getHistory();
  const filtered = history.filter((s) => s !== slug);
  const newHistory = [slug, ...filtered].slice(0, 5);
  storage.set(STORAGE_KEYS.RECENT_FILMS, JSON.stringify(newHistory));
}

export function formatSlugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
