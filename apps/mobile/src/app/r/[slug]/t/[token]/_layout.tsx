import { Stack, useLocalSearchParams } from "expo-router";
import { VenueProvider } from "@/lib/venue";
import { colors } from "@/lib/theme";

export default function VenueLayout() {
  const { slug, token } = useLocalSearchParams<{ slug: string; token: string }>();

  return (
    <VenueProvider slug={String(slug)} token={String(token)}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.cream },
          animation: "slide_from_right",
        }}
      />
    </VenueProvider>
  );
}
