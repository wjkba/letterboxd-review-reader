import { router } from "expo-router";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { searchMovies, TMDbMovie } from "../utils/tmdb";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDbMovie[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (query.trim().length > 0) {
        setIsSearching(true);
        const movies = await searchMovies(query);
        setResults(movies);
        setIsSearching(false);
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [query]);

  function getYear(releaseDate: string): string {
    if (!releaseDate) return "";
    return releaseDate.split("-")[0];
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search movies..."
          style={styles.input}
          autoFocus={true}
          placeholderTextColor="#999"
        />
      </View>

      {isSearching && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#000" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {!isSearching && query.length > 0 && results.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No results found</Text>
        </View>
      )}

      {query.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Start typing to search</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.resultItem}
            onPress={() => {
              router.push({
                pathname: "/ReviewsScreen",
                params: { slug: `tmdb/${item.id}` },
              });
            }}
          >
            <Text style={styles.resultText}>
              {item.title} ({getYear(item.release_date)})
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
    backgroundColor: "#f0f0f0",
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: "#f0f0f0",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  input: {
    width: "100%",
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
  },
  loadingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 8,
  },
  resultItem: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  resultText: {
    fontSize: 15,
    color: "#1a1a1a",
    fontWeight: "500",
  },
});
