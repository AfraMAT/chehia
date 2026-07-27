import { Redirect, useLocalSearchParams } from "expo-router";
import { CartScreen } from "@/components/venue/cart-screen";
import { VenueHome } from "@/components/venue/venue-home";
import { useVenueState } from "@/lib/venue";

/** P4 · Scanned-flow cart route — guards loading/invalid, then renders the
 * shared CartScreen (order placed by qr_token; navigation via basePath). */
export default function ScannedCart() {
  const { state } = useVenueState();
  const { slug, token } = useLocalSearchParams<{ slug: string; token: string }>();
  if (state.status === "invalid") {
    return <Redirect href={`/r/${slug}/t/${token}`} />;
  }
  // VenueHome renders the loading spinner — a deep link can land here cold.
  if (state.status !== "ready") return <VenueHome />;
  return <CartScreen />;
}
