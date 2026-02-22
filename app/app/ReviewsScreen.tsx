import { getLocalFilmReviews, saveFilmReviews } from "@/utils/reviews";
import { addToHistory } from "@/utils/history";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import RenderHtml from "react-native-render-html";
import { Review, getReviews } from "../utils/scraper";

function ReviewsScreen() {
  const slug = useLocalSearchParams().slug as string ;
  const windowWidth = useWindowDimensions().width;
  const [displayedReviews, setDisplayedReviews] = useState<Review[] | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<null | string>(null);
  const startPageRef = useRef(1);
  const hasFetchedRef = useRef(false);
  const hasAddedToHistoryRef = useRef(false);

  useEffect(() => {
    if (slug && !hasAddedToHistoryRef.current) {
      addToHistory(slug);
      hasAddedToHistoryRef.current = true;
    }
  }, [slug]);

  useEffect(() => {
    async function loadReviews() {
      if (hasFetchedRef.current) return;
      if (!slug) {
        return;
      }

      const localFilmReviews = getLocalFilmReviews(slug)
      if (localFilmReviews) {
        setDisplayedReviews(localFilmReviews);
        return;
      }

      setIsLoading(true);
      try {
        const reviews = await getReviews(
          slug as string,
          startPageRef.current,
          10
        );
        console.log("🚀 ~ loadReviews ~ reviews:", reviews);
        setDisplayedReviews(reviews || []);
        saveFilmReviews(slug as string, reviews);
      } catch (error) {
        console.log(error);
        console.error(error);
        setErrorMessage("Failed to load reviews.");
      } finally {
        setIsLoading(false);
        hasFetchedRef.current = true;
      }
    }
    loadReviews();
  }, [slug]);

  if (errorMessage) {
    return (
      <View style={styles.centeredContainer}>
        <Text>{errorMessage}</Text>
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
        data={displayedReviews}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.reviewItem}>
            <Text style={styles.author}>{item.author}</Text>
            <RenderHtml
              systemFonts={["Literata-Regular"]}
              baseStyle={{ fontFamily: "Literata-Regular" }}
              tagsStyles={{
                p: {
                  fontSize: 15,
                  textAlign: "justify",
                  marginBottom: 12,
                  lineHeight: 25,
                },
                li: {
                  marginBottom: 6,
                },
              }}
              contentWidth={windowWidth}
              source={{ html: item.html }}
            />
          </View>
        )}
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
});

export default ReviewsScreen;
