import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    "Literata-Regular": require("../assets/fonts/Literata-Regular.ttf"),
    "Literata-Medium": require("../assets/fonts/Literata-Medium.ttf"),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  return (
    <Stack screenOptions={{ title: "" }}>
      <Stack.Screen name="index" options={{ title: "" }} />
      <Stack.Screen options={{ headerShown: false }} name="ReviewsScreen" />
    </Stack>
  );
}
