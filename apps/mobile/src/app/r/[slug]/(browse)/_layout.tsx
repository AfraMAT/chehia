import { Stack, useLocalSearchParams } from "expo-router";
import { VenueProvider } from "@/lib/venue";
import { SessionProvider } from "@/lib/session";
import { colors } from "@/lib/theme";

/** Browse flow (discovery) — venue found via /app, table picked in-session.
 * Same VenueProvider as the scanned flow, mounted in browse mode (slug-keyed
 * cart, table_id ordering) so every downstream screen is shared, not copied.
 * SessionProvider is mounted too (group ordering self-hides off a scanned QR). */
export default function BrowseLayout() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  return (
    <VenueProvider slug={String(slug)} browse>
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
