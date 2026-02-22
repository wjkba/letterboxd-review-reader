import { Ionicons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import { useLayoutEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { RecentReviews } from "../components/RecentReviews";

export default function Index() {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          style={{ marginRight: 16 }}
          onPress={() => router.push("/SettingsScreen")}
        >
          <Ionicons name="settings-outline" size={24} color="#222" />
        </Pressable>
      ),
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <RecentReviews
        onItemPress={(slug) => {
          router.push({
            pathname: "/ReviewsScreen",
            params: { slug },
          });
        }}
      />
      <Pressable
        style={styles.fab}
        onPress={() => router.push("/SearchScreen")}
      >
        <Ionicons name="search" size={28} color="white" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
