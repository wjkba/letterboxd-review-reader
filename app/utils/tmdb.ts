import Constants from "expo-constants";
import { getStoredTmdbToken } from "./storage";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export interface TMDbMovie {
  id: number;
  title: string;
  release_date: string;
}

export interface TMDbSearchResponse {
  results: TMDbMovie[];
}

function getToken(): string | undefined {
  const userToken = getStoredTmdbToken();
  if (userToken) return userToken;
  
  return Constants.expoConfig?.extra?.tmdbReadAccessToken || process.env.EXPO_PUBLIC_TMDB_READ_ACCESS_TOKEN;
}

export async function searchMovies(query: string): Promise<TMDbMovie[]> {
  const token = getToken();
  
  if (!query.trim() || !token) {
    return [];
  }

  const url = `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(
    query
  )}&include_adult=false`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data: TMDbSearchResponse = await response.json();

  return data.results || [];
}
