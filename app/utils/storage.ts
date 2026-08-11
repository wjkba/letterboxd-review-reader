import { createMMKV } from "react-native-mmkv";

const storage = createMMKV();

export const STORAGE_KEYS = {
  TMDB_ACCESS_TOKEN: "tmdb_access_token",
  RECENT_FILMS: "recent_films",
  READER_POSITION_PREFIX: "review_reader_position:",
} as const;

export type ReadingPosition = { version: 1; fingerprint: string; reviewIndexHint: number; wordOffset: number };
export function reviewFingerprint(author: string, html: string): string { return `${author.replace(/\s+/g, " ").trim()}\u001f${html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}`; }
function positionKey(slug: string): string { return `${STORAGE_KEYS.READER_POSITION_PREFIX}${slug}`; }
export function getReadingPosition(slug: string): ReadingPosition | null {
  const raw = storage.getString(positionKey(slug)); if (!raw) return null;
  try { const value: unknown = JSON.parse(raw); if (!value || typeof value !== "object") return null; const p = value as Partial<ReadingPosition>;
    if (p.version !== 1 || typeof p.fingerprint !== "string" || !p.fingerprint || !Number.isInteger(p.reviewIndexHint) || (p.reviewIndexHint as number) < 0 || !Number.isFinite(p.wordOffset) || (p.wordOffset as number) < 0) return null;
    return { version: 1, fingerprint: p.fingerprint, reviewIndexHint: p.reviewIndexHint as number, wordOffset: p.wordOffset as number };
  } catch { return null; }
}
export function saveReadingPosition(slug: string, position: Omit<ReadingPosition, "version">): void { if (slug && position.fingerprint && Number.isInteger(position.reviewIndexHint) && position.reviewIndexHint >= 0 && Number.isFinite(position.wordOffset) && position.wordOffset >= 0) storage.set(positionKey(slug), JSON.stringify({ version: 1, ...position })); }
export function clearReadingPosition(slug: string): void { storage.remove(positionKey(slug)); }

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
