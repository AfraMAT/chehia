import { Stack, useLocalSearchParams } from "expo-router";
import { VenueProvider } from "@/lib/venue";
import { SessionProvider } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function VenueLayout() {
  const { slug, token } = useLocalSearchParams<{ slug: string; token: string }>();

  return (
    <VenueProvider slug={String(slug)} token={String(token)}>
      <SessionProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.cream },
            animation: "slide_from_right",
          }}
        />
      </SessionProvider>
    </VenueProvider>
  );
}
