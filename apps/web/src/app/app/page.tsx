import type { Metadata } from "next";
import type { DiscoveryVenue } from "@chehia/shared";
import { getServerSupabase } from "@/lib/supabase";
import { Discover } from "./discover";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chehia — Trouvez votre restaurant",
  description: "Commandez à table dans les cafés et restaurants tunisiens près de vous.",
  // The consumer app's one canonical home is the subdomain (see proxy.ts).
  alternates: { canonical: "https://app.chehia.app" },
};

/** app.chehia.app — consumer discovery: find a venue, browse the menu, order. */
export default async function AppHome() {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("restaurants")
    // select("*") rather than an explicit column list: a prod deploy where the
    // reviews migration hasn't landed yet (rating_avg/rating_count absent) still
    // returns the catalogue instead of erroring on unknown columns. The rating
    // UI is guarded on rating_count, so ratings simply stay hidden until then.
    .select("*")
    .eq("is_active", true)
    .order("name")
    .overrideTypes<DiscoveryVenue[], { merge: false }>();

  // Distinguish a genuine empty catalogue from a failed query so the client can
  // offer a retry instead of a misleading "no restaurants" message.
  return <Discover venues={data ?? []} loadError={!!error} />;
}
