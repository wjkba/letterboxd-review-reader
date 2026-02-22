import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { getHistory, formatSlugToTitle } from "@/utils/storage";

interface RecentReviewsProps {
  onItemPress?: (slug: string) => void;
}

export function RecentReviews({ onItemPress }: RecentReviewsProps) {
  const recentFilms = getHistory();

  if (recentFilms.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No recent films</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recent</Text>
      {recentFilms.map((item) => (
        <TouchableOpacity
          key={item}
          style={styles.item}
          onPress={() => onItemPress?.(item)}
        >
          <Text style={styles.text}>{formatSlugToTitle(item)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
    fontWeight: "bold",
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  text: {
    fontSize: 14,
    color: "#000",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
  },
});
