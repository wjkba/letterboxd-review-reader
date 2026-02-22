import { Ionicons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import { useLayoutEffect, useState } from "react";
import {
  Button,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Index() {
  const [slug, setSlug] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  function handleInputChange(userInputSlug: string) {
    const formattedSlug = userInputSlug.replace(/\s+/g, "-");
    setSlug(formattedSlug);
  }

  async function handleLoadReviews() {
    const trimmedSlug = slug.trim();

    if (!trimmedSlug.length) {
      setErrorMessage("Please enter a film slug");
      return;
    }

    router.push({
      pathname: "/ReviewsScreen",
      params: {
        slug,
      },
    });
  }

  return (
    <View style={styles.centeredContainer}>
      <View style={styles.inputContainer}>
        <TextInput
          value={slug}
          onChangeText={handleInputChange}
          placeholder="Letterboxd film slug"
          style={styles.input}
          keyboardType="default"
          autoFocus={true}
        />
        <Button onPress={handleLoadReviews} title="Load Reviews" />
      </View>

      {errorMessage && <Text>{errorMessage}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 0.9,
    justifyContent: "center",
    alignItems: "center",
  },
  inputContainer: {
    // maxWidth: 450,
  },
  input: {
    width: 200,
    textAlign: "center",
    backgroundColor: "white",
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
});
