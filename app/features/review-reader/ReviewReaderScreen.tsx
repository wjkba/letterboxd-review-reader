import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useCallback, useState } from "react";
import { useReviewFeed } from "./data/useReviewFeed";
import { ReaderViewport } from "./components/ReaderViewport";
import { useHtmlPageReader } from "./reader/useHtmlPageReader";

type ReviewReaderScreenProps = { slug: string };

export function ReviewReaderScreen({ slug }: ReviewReaderScreenProps) {
  const feed = useReviewFeed(slug);
  const { width } = useWindowDimensions();
  const [viewportHeight, setViewportHeight] = useState(0);
  const onLayout = useCallback((height: number) => setViewportHeight((current) => current === height ? current : height), []);
  const contentWidth = Math.max(0, width - 48);
  const reader = useHtmlPageReader({ documentKey: feed.resolvedSlug ?? slug, canonicalSlug: feed.resolvedSlug, reviews: feed.reviews, batchRanges: feed.batchRanges, viewportHeight, contentWidth, hasMore: feed.hasMore, isLoadingMore: feed.isLoadingMore, loadMoreError: feed.loadMoreError, onLoadMore: feed.loadMore });

  if (feed.isResolving || feed.isLoading) return <StateView label="Loading reviews…" busy />;
  if (feed.errorMessage) return <StateView label={feed.errorMessage} />;
  if (!feed.reviews.length) return <StateView label="No reviews found." />;

  return <ReaderViewport page={reader.currentPage} measurement={reader.measurement} contentWidth={contentWidth} pageNumber={reader.pageIndex + 1} pageCount={reader.pages.length} isComplete={reader.isComplete} canPrevious={reader.canPrevious} canNext={reader.canNext} onMeasure={reader.onMeasure} onPrevious={reader.onPrevious} onNext={reader.onNext} onLayout={onLayout} isPreparing={!reader.currentPage} footer={feed.loadMoreError ? <View style={styles.footer}><Text style={styles.footerError}>{feed.loadMoreError}</Text><Pressable onPress={feed.retryLoadMore} accessibilityRole="button"><Text style={styles.retry}>Retry loading more reviews</Text></Pressable></View> : feed.isLoadingMore ? <ActivityIndicator style={styles.footer} /> : null} />;
}

function StateView({ label, busy = false }: { label: string; busy?: boolean }) {
  return <View style={styles.state}>{busy ? <ActivityIndicator color="#292722" /> : null}<Text style={styles.stateText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  state: { alignItems: "center", backgroundColor: "#fbfaf7", flex: 1, gap: 12, justifyContent: "center", padding: 24 },
  stateText: { color: "#292722", fontFamily: "Literata-Regular", textAlign: "center" },
  footer: { alignItems: "center", gap: 6, paddingVertical: 10 },
  footerError: { color: "#8b4540", fontSize: 12 },
  retry: { color: "#292722", fontFamily: "Literata-Medium", fontSize: 12, textDecorationLine: "underline" },
});
