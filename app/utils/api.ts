import axios from "axios";

const API_BASE_URL = "http://192.168.33.12:3000";

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
    const response = await axios.get(`${API_BASE_URL}/reviews/${slug}`);
    return response.data;
  },
};
