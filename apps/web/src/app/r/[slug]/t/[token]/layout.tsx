import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase";
import type { Category, MenuItem, Modifier, ModifierGroup, Restaurant, Table } from "@chehia/shared";
import { VenueProvider, type VenueBundle } from "./venue-provider";
import { InvalidQr } from "./invalid-qr";

export const dynamic = "force-dynamic";

type Params = { slug: string; token: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = getServerSupabase();
  const { data } = await supabase.from("restaurants").select("name").eq("slug", slug).maybeSingle();
  return { title: data?.name ?? "Menu" };
}

async function loadBundle(slug: string, token: string): Promise<VenueBundle | null> {
  const supabase = getServerSupabase();

  // A transient DB/network failure must NOT render the permanent
  // "invalid QR" screen — throw so the error boundary offers a retry.
  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle<Restaurant>();
  if (restaurantError) throw new Error("venue load failed");
  if (!restaurant) return null;

  const { data: table, error: tableError } = await supabase
    .from("tables")
    .select("id, label, zone, qr_token")
    .eq("restaurant_id", restaurant.id)
    .eq("qr_token", token)
    .eq("is_active", true)
    .maybeSingle<Pick<Table, "id" | "label" | "zone" | "qr_token">>();
  if (tableError) throw new Error("venue load failed");
  if (!table) return null;

  const [{ data: categories }, { data: items }, { data: groups }, { data: modifiers }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order")
      .overrideTypes<Category[], { merge: false }>(),
    supabase
      .from("items")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order")
      .overrideTypes<MenuItem[], { merge: false }>(),
    supabase
      .from("modifier_groups")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order")
      .overrideTypes<Omit<ModifierGroup, "modifiers">[]>(),
    supabase
      .from("modifiers")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_available", true)
      .order("sort_order")
      .overrideTypes<Modifier[], { merge: false }>(),
  ]);

  const groupsByItem: Record<string, ModifierGroup[]> = {};
  for (const group of groups ?? []) {
    const withMods: ModifierGroup = {
      ...group,
      modifiers: (modifiers ?? []).filter((m) => m.group_id === group.id),
    };
    (groupsByItem[group.item_id] ??= []).push(withMods);
  }

  return { restaurant, table, categories: categories ?? [], items: items ?? [], groupsByItem };
}

export default async function VenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Params>;
}) {
  const { slug, token } = await params;
  const bundle = await loadBundle(slug, token);

  if (!bundle) {
    return <InvalidQr />;
  }

  return (
    <div className="mx-auto w-full max-w-[520px] min-h-dvh bg-cream flex flex-col">
      <VenueProvider bundle={bundle}>{children}</VenueProvider>
    </div>
  );
}
