import { View, Text, StyleSheet, TextInput, Button } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SettingsScreen() {
  const [localIp, setLocalIp] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const storedIp = await AsyncStorage.getItem("localIp");
      if (storedIp) setLocalIp(storedIp);
    })();
  }, []);

  async function handleSave() {
    await AsyncStorage.setItem("localIp", localIp);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <View style={styles.container}>
      <Text>Local IP for API requests:</Text>
      <TextInput
        style={styles.input}
        value={localIp}
        onChangeText={setLocalIp}
        placeholder="e.g. 192.168.1.100"
        autoCapitalize="none"
        keyboardType="numeric"
      />
      <Button title="Save" onPress={handleSave} />
      {saved && <Text>Saved!</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  input: {
    backgroundColor: "white",
    marginVertical: 8,
    padding: 8,
    borderWidth: 1,
  },
});
