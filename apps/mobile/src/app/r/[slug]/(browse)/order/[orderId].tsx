import { useLocalSearchParams } from "expo-router";
import { OrderScreen } from "@/components/venue/order-screen";
import { useVenueState } from "@/lib/venue";

/** Browse-flow order tracking route — renders the shared OrderScreen once the
 * venue bundle is ready (navigation derives from basePath). */
export default function BrowseOrder() {
  const { state } = useVenueState();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  if (state.status !== "ready") {
    return null;
  }
  return <OrderScreen orderId={String(orderId)} />;
}
