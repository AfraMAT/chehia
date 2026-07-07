import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { appearanceCssVars } from "@chehia/shared";
import { getServerSupabase } from "@/lib/supabase";
import { VenueProvider } from "@/app/r/_venue/venue-provider";
import { loadScannedVenue } from "@/app/r/_venue/loader";
import { InvalidQr } from "@/app/r/_venue/invalid-qr";

export const dynamic = "force-dynamic";

type Params = { slug: string; token: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = getServerSupabase();
  const { data } = await supabase.from("restaurants").select("name").eq("slug", slug).maybeSingle();
  return { title: data?.name ?? "Menu" };
}

export default async function VenueTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Params>;
}) {
  const { slug, token } = await params;
  const bundle = await loadScannedVenue(slug, token);

  if (!bundle) {
    return <InvalidQr />;
  }

  const themeVars = appearanceCssVars(bundle.restaurant.appearance) as CSSProperties;
  return (
    <div style={themeVars} className="min-h-dvh bg-cream">
      <div className="mx-auto w-full max-w-[520px] min-h-dvh bg-cream flex flex-col">
        <VenueProvider bundle={bundle} basePath={`/r/${slug}/t/${token}`}>
          {children}
        </VenueProvider>
      </div>
    </div>
  );
}
