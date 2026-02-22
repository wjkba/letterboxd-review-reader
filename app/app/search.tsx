import { router } from "expo-router";
import { useState } from "react";
import {
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Search() {
  const [slug, setSlug] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    <View style={styles.container}>
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
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  inputContainer: {
    width: "100%",
    maxWidth: 300,
  },
  input: {
    width: "100%",
    textAlign: "center",
    backgroundColor: "white",
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
});
