import { Discover } from "@/components/discover";

/** Consumer discovery (/app) — find a venue, browse the menu, order to a table.
 * The QR-scan home stays at "/"; this is the browse-first entry point. */
export default function DiscoverRoute() {
  return <Discover />;
}
