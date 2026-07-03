import type { Metadata } from "next";
import type { DiscoveryVenue } from "@chehia/shared";
import { getServerSupabase } from "@/lib/supabase";
import { Discover } from "./discover";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chehia — Trouvez votre restaurant",
  description: "Commandez à table dans les cafés et restaurants tunisiens près de vous.",
};

/** app.chehia.app — consumer discovery: find a venue, browse the menu, order. */
export default async function AppHome() {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("restaurants")
    .select("id, slug, name, tagline_i18n, city, address, cover_url, logo_url, plan, latitude, longitude")
    .eq("is_active", true)
    .order("name")
    .overrideTypes<DiscoveryVenue[], { merge: false }>();

  return <Discover venues={data ?? []} />;
}
