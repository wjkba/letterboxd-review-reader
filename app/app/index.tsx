import { useLayoutEffect, useState } from "react";
import {
  Button,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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

    // TEMPORARY
    // const timer = setTimeout(() => {
    //   router.push({
    //     pathname: "/ReviewsScreen",
    //     params: {
    //       slug: "nosferatu",
    //     },
    //   });
    // }, 100);

    // return () => clearTimeout(timer);
  }, []);

  function handleInputChange(userInputSlug: string) {
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
    backgroundColor: "white",
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
});
