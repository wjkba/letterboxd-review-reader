import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_API_BASE_URL = "http://192.168.33.12:3000";

export interface Review {
  author: string;
  html: string;
}

export interface ReviewsResponse {
  message: string;
  slug: string;
  reviews: Review[];
}

export const api = {
  async getReviews(
    slug: string,
    startPage: number = 1,
    limit: number = 5
  ): Promise<ReviewsResponse> {
    let apiBaseUrl = DEFAULT_API_BASE_URL;
    const storedIp = await AsyncStorage.getItem("localIp");
    if (storedIp) {
      apiBaseUrl = `http://${storedIp}:3000`;
    }
    const response = await axios.get(
      `${apiBaseUrl}/reviews/${slug}?startPage=${startPage}&limit=${limit}`
    );
    return response.data;
  },
};
