import { Redirect, useLocalSearchParams } from "expo-router";
import { CartScreen } from "@/components/venue/cart-screen";
import { useVenueState } from "@/lib/venue";

/** P4 · Scanned-flow cart route — guards loading/invalid, then renders the
 * shared CartScreen (order placed by qr_token; navigation via basePath). */
export default function ScannedCart() {
  const { state } = useVenueState();
  const { slug, token } = useLocalSearchParams<{ slug: string; token: string }>();
  if (state.status === "invalid") {
    return <Redirect href={`/r/${slug}/t/${token}`} />;
  }
  if (state.status !== "ready") return null;
  return <CartScreen />;
}
