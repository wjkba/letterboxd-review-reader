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
    gap: 8,
  },
  title: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
    fontWeight: "bold",
  },
  item: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 15,
    color: "#1a1a1a",
    fontWeight: "500",
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
