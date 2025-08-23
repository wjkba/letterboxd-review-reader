import { useState } from "react";
import { Button, StyleSheet, TextInput, View } from "react-native";

export default function Index() {
  const [slug, setSlug] = useState("");

  function handleInputChange(value: string) {
    setSlug(value);
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View>
        <TextInput
          onChangeText={handleInputChange}
          placeholder="Letterboxd film slug"
          style={styles.input}
        />
        <Button title="Load Reviews" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
});
