import { MenuScreen } from "@/components/venue/menu-screen";
import { VenueHome } from "@/components/venue/venue-home";
import { useVenueState } from "@/lib/venue";

/** Browse-flow menu route — guards loading/invalid, then renders the shared
 * MenuScreen (cart route derives from the provider's basePath). */
export default function BrowseMenu() {
  const { state } = useVenueState();
  if (state.status !== "ready") {
    // VenueHome renders the loading spinner and the venue-not-found screen.
    return <VenueHome />;
  }
  return <MenuScreen />;
}
