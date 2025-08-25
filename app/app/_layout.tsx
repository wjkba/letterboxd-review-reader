import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ title: "" }}>
      <Stack.Screen name="index" options={{ title: "" }} />
      <Stack.Screen options={{ headerShown: false }} name="ReviewsScreen" />
    </Stack>
  );
}
