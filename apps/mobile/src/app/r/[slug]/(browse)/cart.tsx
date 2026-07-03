import { CartScreen } from "@/components/venue/cart-screen";
import { VenueHome } from "@/components/venue/venue-home";
import { useVenueState } from "@/lib/venue";

/** Browse-flow cart route — guards loading/invalid, then renders the shared
 * CartScreen (order placed by table_id; navigation via basePath). */
export default function BrowseCart() {
  const { state } = useVenueState();
  if (state.status !== "ready") {
    return <VenueHome />;
  }
  return <CartScreen />;
}
