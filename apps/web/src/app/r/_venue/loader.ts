import type {
  Category,
  MenuItem,
  Modifier,
  ModifierGroup,
  Restaurant,
} from "@chehia/shared";
import { getServerSupabase } from "@/lib/supabase";
import type { TableChoice, VenueBundle } from "./venue-provider";

/** Load the active venue by slug. Returns null when it doesn't exist / is inactive. */
async function loadRestaurant(slug: string): Promise<Restaurant | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle<Restaurant>();
  // A transient DB/network failure must NOT render the permanent "not found"
  // screen — throw so the error boundary offers a retry.
  if (error) throw new Error("venue load failed");
  return data;
}

/** Menu (categories, items, modifier structure) for a venue. */
async function loadMenu(restaurantId: string): Promise<Pick<VenueBundle, "categories" | "items" | "groupsByItem">> {
  const supabase = getServerSupabase();
  const [{ data: categories }, { data: items }, { data: groups }, { data: modifiers }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("sort_order")
      .overrideTypes<Category[], { merge: false }>(),
    supabase
      .from("items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order")
      .overrideTypes<MenuItem[], { merge: false }>(),
    supabase
      .from("modifier_groups")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order")
      .overrideTypes<Omit<ModifierGroup, "modifiers">[]>(),
    supabase
      .from("modifiers")
      .select("*")
      .eq("restaurant_id", restaurantId)
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

  return { categories: categories ?? [], items: items ?? [], groupsByItem };
}

/** Scanned flow: venue + the table resolved from its QR token. */
export async function loadScannedVenue(slug: string, token: string): Promise<VenueBundle | null> {
  const supabase = getServerSupabase();
  const restaurant = await loadRestaurant(slug);
  if (!restaurant) return null;

  // Resolve the table via a token-scoped RPC (qr_token is a capability and must
  // not be enumerable). Verify it belongs to this slug's restaurant.
  const { data: resolved, error: tableError } = await supabase
    .rpc("resolve_table", { p_qr_token: token })
    .maybeSingle<{ id: string; restaurant_id: string; label: string; zone: string }>();
  if (tableError) throw new Error("venue load failed");
  if (!resolved || resolved.restaurant_id !== restaurant.id) return null;

  const table: TableChoice = {
    id: resolved.id,
    label: resolved.label,
    zone: resolved.zone,
    qr_token: token,
  };

  return { restaurant, table, ...(await loadMenu(restaurant.id)) };
}

/** Browse flow: venue + its menu + the tables the customer can pick from. */
export async function loadBrowseVenue(slug: string): Promise<VenueBundle | null> {
  const supabase = getServerSupabase();
  const restaurant = await loadRestaurant(slug);
  if (!restaurant) return null;

  const { data: tableRows } = await supabase.rpc("list_venue_tables", { p_slug: slug });
  const rows = (tableRows ?? []) as { id: string; label: string; zone: string; sort_order: number }[];
  const tables: TableChoice[] = rows.map((t) => ({ id: t.id, label: t.label, zone: t.zone }));

  return { restaurant, table: null, tables, ...(await loadMenu(restaurant.id)) };
}
