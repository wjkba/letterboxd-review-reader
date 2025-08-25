import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

export default function Index() {
  const [slug, setSlug] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleInputChange(userInputSlug: string) {
    console.log(userInputSlug);
    setSlug(userInputSlug);
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  inputContainer: {
    // maxWidth: 450,
  },
  input: {
    width: 200,
    textAlign: "center",
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
});
