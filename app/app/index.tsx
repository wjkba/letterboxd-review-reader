import { useState } from "react";
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../utils/api";

export default function Index() {
  const [isLoading, setIsLoading] = useState(false);
  const [slug, setSlug] = useState("");
  const [errorMessage, setErrorMessage] = useState<null | string>(null);

  function handleInputChange(userInputSlug: string) {
    console.log(userInputSlug);
    setSlug(userInputSlug);
  }

  async function handleLoadReviews() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await api.getReviews(slug);
      console.log("🚀 ~ handleLoadReviews ~ data:", data);
    } catch (error) {
      setErrorMessage("Something went wrong while loading reviews");
      console.log(error);
    } finally {
      setIsLoading(false);
    }
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
    <View style={styles.centeredContainer}>
      <View style={styles.inputContainer}>
        <TextInput
          value={slug}
          onChangeText={handleInputChange}
          placeholder="Letterboxd film slug"
          style={styles.input}
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
