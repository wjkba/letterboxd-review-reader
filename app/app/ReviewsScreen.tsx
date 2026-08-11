import {
  getFilmReviewsCache,
  saveFilmReviews,
} from "@/utils/reviews";
import { addToHistory } from "@/utils/storage";
import { useLocalSearchParams } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import RenderHtml from "react-native-render-html";
import { Review, fetchReviewsBatch, resolveSlug } from "../utils/scraper";

type PaginatedReviewBatch = {
  reviews: Review[];
  nextPage: number | null;
  hasMore: boolean;
};

type CachedReviews = Review[] | Partial<PaginatedReviewBatch>;

const REVIEW_SYSTEM_FONTS = ["Literata-Regular"];
const REVIEW_BASE_STYLE = { fontFamily: "Literata-Regular" };
const REVIEW_TAGS_STYLES = {
  p: {
    fontSize: 15,
    textAlign: "justify" as const,
    marginBottom: 12,
    lineHeight: 25,
  },
  li: {
    marginBottom: 6,
  },
};

type ReviewRowProps = {
  item: Review;
  contentWidth: number;
};

const ReviewRow = memo(
  function ReviewRow({ item, contentWidth }: ReviewRowProps) {
    return (
      <View style={styles.reviewItem}>
        <Text style={styles.author}>{item.author}</Text>
        <RenderHtml
          systemFonts={REVIEW_SYSTEM_FONTS}
          baseStyle={REVIEW_BASE_STYLE}
          tagsStyles={REVIEW_TAGS_STYLES}
          contentWidth={contentWidth}
          source={{ html: item.html }}
        />
      </View>
    );
  },
  (previous, next) =>
    previous.item === next.item && previous.contentWidth === next.contentWidth
);

const reviewKeyExtractor = (_item: Review, index: number) => index.toString();

function normalizeBatch(value: unknown): PaginatedReviewBatch {
  // The array branch keeps this screen compatible with the current scraper
  // while the data layer moves to the paginated response below.
  if (Array.isArray(value)) {
    return {
      reviews: value,
      nextPage: value.length ? 2 : null,
      hasMore: value.length > 0,
    };
  }

  const batch = (value || {}) as Partial<PaginatedReviewBatch>;
  return {
    reviews: batch.reviews || [],
    nextPage: batch.nextPage ?? (batch.hasMore ? 2 : null),
    hasMore: batch.hasMore ?? false,
  };
}

function ReviewsScreen() {
  const slug = useLocalSearchParams().slug as string ;
  const windowWidth = useWindowDimensions().width;
  const [displayedReviews, setDisplayedReviews] = useState<Review[] | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<null | string>(null);
  const [paginationError, setPaginationError] = useState(false);
  const reviewListRef = useRef<Review[]>([]);
  const nextPageRef = useRef<number | null>(1);
  const hasMoreRef = useRef(true);
  const isLoadingMoreRef = useRef(false);
  const screenGenerationRef = useRef(0);
  const hasAddedToHistoryRef = useRef(false);
  const resolvedSlugRef = useRef<string | null>(null);
  const renderReview: ListRenderItem<Review> = useCallback(
    ({ item }) => <ReviewRow item={item} contentWidth={windowWidth} />,
    [windowWidth]
  );

  const loadNextPage = useCallback(async () => {
    const finalSlug = resolvedSlugRef.current;
    const nextPage = nextPageRef.current;
    const requestGeneration = screenGenerationRef.current;
    if (!finalSlug || nextPage === null || !hasMoreRef.current || isLoadingMoreRef.current) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    setPaginationError(false);
    try {
      const batch = normalizeBatch(
        await fetchReviewsBatch(finalSlug, nextPage, 1) as unknown
      );
      if (requestGeneration !== screenGenerationRef.current) return;
      const mergedReviews = [...reviewListRef.current, ...batch.reviews];
      reviewListRef.current = mergedReviews;
      setDisplayedReviews(mergedReviews);
      nextPageRef.current = batch.nextPage;
      hasMoreRef.current = batch.hasMore;
      saveFilmReviews(finalSlug, mergedReviews, {
        nextPage: batch.nextPage,
        hasMore: batch.hasMore,
      });
    } catch (error) {
      console.error("Failed to load more reviews:", error);
      if (requestGeneration === screenGenerationRef.current) {
        setPaginationError(true);
      }
    } finally {
      if (requestGeneration === screenGenerationRef.current) {
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    screenGenerationRef.current += 1;
    setDisplayedReviews(null);
    reviewListRef.current = [];
    setIsLoading(false);
    setIsLoadingMore(false);
    setErrorMessage(null);
    setPaginationError(false);
    nextPageRef.current = 1;
    hasMoreRef.current = true;
    isLoadingMoreRef.current = false;

    async function resolveAndFetch() {
      if (!slug) return;

      setIsResolving(true);
      let finalSlug: string;

      try {
        finalSlug = await resolveSlug(slug);
        resolvedSlugRef.current = finalSlug;
      } catch (error) {
        console.error("Failed to resolve slug:", error);
        finalSlug = slug;
        resolvedSlugRef.current = slug;
      }

      if (cancelled) return;

      if (!hasAddedToHistoryRef.current) {
        addToHistory(finalSlug);
        hasAddedToHistoryRef.current = true;
      }
      setIsResolving(false);

      const localFilmReviews = getFilmReviewsCache(finalSlug) as CachedReviews | null;
      if (localFilmReviews) {
        const cachedBatch = normalizeBatch(localFilmReviews);
        reviewListRef.current = cachedBatch.reviews;
        setDisplayedReviews(cachedBatch.reviews);
        nextPageRef.current = cachedBatch.nextPage;
        hasMoreRef.current = cachedBatch.hasMore;
        return;
      }

      setIsLoading(true);
      try {
        const batch = normalizeBatch(
          await fetchReviewsBatch(finalSlug, 1, 1) as unknown
        );
        if (cancelled) return;
        reviewListRef.current = batch.reviews;
        setDisplayedReviews(batch.reviews);
        nextPageRef.current = batch.nextPage;
        hasMoreRef.current = batch.hasMore;
        // Keep the existing cache writer compatible; the cache owner can
        // additionally persist nextPage/hasMore without changing this UI.
        saveFilmReviews(finalSlug, batch.reviews, {
          nextPage: batch.nextPage,
          hasMore: batch.hasMore,
        });
      } catch (error) {
        console.error(error);
        if (!cancelled) setErrorMessage("Failed to load reviews.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    resolveAndFetch();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (errorMessage) {
    return (
      <View style={styles.centeredContainer}>
        <Text>{errorMessage}</Text>
      </View>
    );
  }

  if (isResolving) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="black" />
        <Text style={{ marginTop: 10 }}>Loading movie...</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="black" />
        <Text style={{ marginTop: 10 }}>Loading reviews...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={displayedReviews || []}
        keyExtractor={reviewKeyExtractor}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        onEndReached={loadNextPage}
        onEndReachedThreshold={0.8}
        ListFooterComponent={
          isLoadingMore || paginationError ? (
            <View style={styles.footer}>
              {isLoadingMore ? (
                <ActivityIndicator size="small" color="black" />
              ) : (
                <>
                  <Text style={styles.footerText}>Couldn’t load more reviews.</Text>
                  <Pressable onPress={loadNextPage} accessibilityRole="button">
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null
        }
        renderItem={renderReview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    paddingTop: 48,
    backgroundColor: "white",
    flex: 1,
    paddingHorizontal: 24,
  },
  reviewItem: {
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: "hsla(0, 0%, 85%, 1.00)",
  },
  author: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  footerText: {
    color: "hsl(0, 0%, 35%)",
  },
  retryText: {
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});

export default ReviewsScreen;
