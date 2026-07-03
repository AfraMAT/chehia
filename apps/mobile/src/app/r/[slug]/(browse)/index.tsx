import { VenueHome } from "@/components/venue/venue-home";

/** Browse landing — venue found via discovery; table is chosen here. The
 * shared VenueHome renders loading / not-found / ready from the provider. */
export default function BrowseLanding() {
  return <VenueHome />;
}
