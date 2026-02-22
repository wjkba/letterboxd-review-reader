import { View, Text, StyleSheet, TextInput, Button } from "react-native";
import { useState, useEffect } from "react";
import { getStoredTmdbToken, setStoredTmdbToken } from "../utils/storage";

export default function SettingsScreen() {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const storedToken = getStoredTmdbToken();
    if (storedToken) setToken(storedToken);
  }, []);

  async function handleSave() {
    setStoredTmdbToken(token.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>TMDB Access Token</Text>
      <Text style={styles.description}>
        Get a read access token from themoviedb.org
      </Text>
      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder="Enter your TMDB access token"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={true}
      />
      <Button title="Save" onPress={handleSave} />
      {saved && <Text style={styles.savedText}>Saved!</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  description: {
    fontSize: 12,
    color: "#666",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "white",
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  savedText: {
    marginTop: 12,
    color: "green",
  },
});
