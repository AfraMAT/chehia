import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase";
import { VenueProvider } from "@/app/r/_venue/venue-provider";
import { loadBrowseVenue } from "@/app/r/_venue/loader";
import { InvalidQr } from "@/app/r/_venue/invalid-qr";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = getServerSupabase();
  const { data } = await supabase.from("restaurants").select("name").eq("slug", slug).maybeSingle();
  return { title: data?.name ?? "Menu" };
}

export default async function VenueBrowseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const bundle = await loadBrowseVenue(slug);

  if (!bundle) {
    return <InvalidQr kind="venue" />;
  }

  return (
    <div className="mx-auto w-full max-w-[520px] min-h-dvh bg-cream flex flex-col">
      <VenueProvider bundle={bundle} basePath={`/r/${slug}`}>
        {children}
      </VenueProvider>
    </div>
  );
}
