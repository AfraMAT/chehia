import { Redirect, useLocalSearchParams } from "expo-router";
import { MenuScreen } from "@/components/venue/menu-screen";
import { useVenueState } from "@/lib/venue";

/** P2/P7 · Scanned-flow menu route — guards loading/invalid, then renders the
 * shared MenuScreen (navigation derives from the provider's basePath). */
export default function ScannedMenu() {
  const { state } = useVenueState();
  const { slug, token } = useLocalSearchParams<{ slug: string; token: string }>();
  if (state.status === "invalid") {
    // The landing screen renders the proper invalid-QR explanation.
    return <Redirect href={`/r/${slug}/t/${token}`} />;
  }
  if (state.status !== "ready") return null;
  return <MenuScreen />;
}
