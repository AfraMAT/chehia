import { Redirect, useLocalSearchParams } from "expo-router";
import { OrderScreen } from "@/components/venue/order-screen";
import { useVenueState } from "@/lib/venue";

/** P5/P9 · Scanned-flow order tracking route — renders the shared OrderScreen
 * once the venue bundle is ready (navigation derives from basePath). */
export default function ScannedOrder() {
  const { state } = useVenueState();
  const { slug, token, orderId } = useLocalSearchParams<{ slug: string; token: string; orderId: string }>();
  if (state.status === "invalid") {
    // The landing screen renders the proper invalid-QR explanation.
    return <Redirect href={`/r/${slug}/t/${token}`} />;
  }
  if (state.status !== "ready") return null;
  return <OrderScreen orderId={String(orderId)} />;
}
