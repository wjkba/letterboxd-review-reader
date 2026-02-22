import Constants from "expo-constants";

const TMDB_ACCESS_TOKEN = Constants.expoConfig?.extra?.tmdbReadAccessToken || process.env.EXPO_PUBLIC_TMDB_READ_ACCESS_TOKEN;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export interface TMDbMovie {
  id: number;
  title: string;
  release_date: string;
}

export interface TMDbSearchResponse {
  results: TMDbMovie[];
}

export async function searchMovies(query: string): Promise<TMDbMovie[]> {
  if (!query.trim() || !TMDB_ACCESS_TOKEN) {
    return [];
  }

  const url = `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(
    query
  )}&include_adult=false`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
    },
  });
  const data: TMDbSearchResponse = await response.json();

  return data.results || [];
}
