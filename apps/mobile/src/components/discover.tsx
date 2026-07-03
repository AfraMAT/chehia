import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  formatDistanceKm,
  haversineKm,
  interpolate,
  LANGUAGE_LABELS,
  LANGUAGES,
  type Coords,
  type DiscoveryVenue,
  type Language,
} from "@chehia/shared";
import { PhotoPlaceholder, T, Wordmark, ZelligeMark } from "./ui";
import { useI18n } from "@/lib/i18n";
import { go } from "@/lib/nav";
import { supabase } from "@/lib/supabase";
import { colors, rowDir } from "@/lib/theme";

type GeoState = "idle" | "locating" | "on" | "denied";

/**
 * Consumer discovery — find a venue by name or near you, then browse & order.
 * Mirrors apps/web discover.tsx: active-venue list, search, distance sort.
 *
 * Geolocation: apps/mobile has no geolocation dependency (expo-location is not
 * installed and this environment cannot rebuild native modules). The "near me"
 * button therefore falls back gracefully to `discover.locationOff`; distance
 * sorting simply stays disabled until coords exist.
 * TODO(native): add `expo-location`, request permission here, and set coords
 * via `getCurrentPositionAsync` to enable "near me".
 */
export function Discover() {
  const { t, tr, lang, setLang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();
  const [venues, setVenues] = useState<DiscoveryVenue[] | null>(null);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id, slug, name, tagline_i18n, city, address, cover_url, logo_url, plan, latitude, longitude")
        .eq("is_active", true)
        .order("name")
        .overrideTypes<DiscoveryVenue[], { merge: false }>();
      if (!cancelled) setVenues(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const locate = useCallback(() => {
    // No geolocation API available without a native dependency. Surface the
    // graceful fallback instead of leaving the button in a dead state.
    // TODO(native): replace with expo-location once it can be installed/rebuilt.
    setGeo("denied");
    setCoords(null);
  }, []);

  const results = useMemo(() => {
    const list = venues ?? [];
    const q = search.trim().toLowerCase();
    const withDist = list.map((v) => {
      const dist =
        coords && v.latitude != null && v.longitude != null
          ? haversineKm(coords, { latitude: v.latitude, longitude: v.longitude })
          : null;
      return { venue: v, dist };
    });
    const filtered = q
      ? withDist.filter(({ venue }) =>
          [venue.name, venue.city, tr(venue.tagline_i18n)].some((s) => s?.toLowerCase().includes(q)),
        )
      : withDist;
    filtered.sort((a, b) => {
      if (a.dist != null && b.dist != null) return a.dist - b.dist;
      if (a.dist != null) return -1;
      if (b.dist != null) return 1;
      return a.venue.name.localeCompare(b.venue.name);
    });
    return filtered;
  }, [venues, search, coords, tr]);

  const sortedByDistance = coords != null && geo === "on";
  const align = { textAlign: (isRtl ? "right" : "left") as "left" | "right" };

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: insets.top }}>
      {/* Header */}
      <View style={[rowDir(lang), { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }]}>
        <Wordmark size={22} />
        <View style={{ flexDirection: "row", gap: 4 }}>
          {LANGUAGES.map((code) => {
            const active = lang === code;
            return (
              <Pressable
                key={code}
                onPress={() => setLang(code as Language)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={LANGUAGE_LABELS[code as Language]}
                style={{
                  paddingHorizontal: 8,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: active ? colors.ink : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <T lang={code === "ar" ? "ar" : "fr"} weight="bold" size={12} color={active ? colors.cream : colors.muted}>
                  {code.toUpperCase()}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Title */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 3 }}>
        <T lang={lang} display size={27} style={align}>
          {t.discover.title}
        </T>
        <T lang={lang} weight="semibold" size={13.5} color={colors.muted} style={align}>
          {t.discover.subtitle}
        </T>
      </View>

      {/* Search + near me */}
      <View style={[rowDir(lang), { paddingHorizontal: 20, paddingTop: 14, gap: 8 }]}>
        <View
          style={[
            rowDir(lang),
            {
              flex: 1,
              height: 46,
              borderRadius: 12,
              backgroundColor: "#FFFFFF",
              borderWidth: 1.5,
              borderColor: colors.border,
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 14,
            },
          ]}
        >
          <T size={14} color={colors.mutedSoft}>
            ⌕
          </T>
          <TextInput
            value={search}
            onChangeText={setSearch}
            accessibilityLabel={t.discover.searchPlaceholder}
            placeholder={t.discover.searchPlaceholder}
            placeholderTextColor={colors.mutedSoft}
            returnKeyType="search"
            style={{
              flex: 1,
              fontFamily: "Manrope_500Medium",
              fontSize: 14,
              color: colors.ink,
              textAlign: isRtl ? "right" : "left",
            }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.discover.nearMe}
          onPress={locate}
          disabled={geo === "locating"}
          style={[
            rowDir(lang),
            {
              height: 46,
              paddingHorizontal: 14,
              borderRadius: 12,
              alignItems: "center",
              gap: 6,
              backgroundColor: sortedByDistance ? colors.sidiBou : "#FFFFFF",
              borderWidth: sortedByDistance ? 0 : 1.5,
              borderColor: colors.borderStrong,
              opacity: geo === "locating" ? 0.6 : 1,
            },
          ]}
        >
          <T size={15} color={sortedByDistance ? "#FFFFFF" : colors.ink}>
            ⌖
          </T>
          <T lang={lang} weight="bold" size={13} color={sortedByDistance ? "#FFFFFF" : colors.ink}>
            {geo === "locating" ? t.discover.locating : t.discover.nearMe}
          </T>
        </Pressable>
      </View>

      {geo === "denied" && (
        <T lang={lang} weight="semibold" size={12.5} color={colors.mutedSoft} style={{ paddingHorizontal: 20, paddingTop: 8, ...align }}>
          {t.discover.locationOff}
        </T>
      )}

      {/* Section label */}
      {results.length > 0 && (
        <T weight="bold" size={12} color={colors.mutedSoft} style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2, letterSpacing: 0.5, ...align }}>
          {(sortedByDistance ? t.discover.nearbyLabel : t.discover.allLabel).toUpperCase()}
        </T>
      )}

      {/* List */}
      {venues === null ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.harissa} size="large" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={({ venue }) => venue.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 24, gap: 10, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              lang={lang}
              title={venues.length === 0 ? t.discover.empty : t.discover.noResults}
              body={venues.length === 0 ? t.discover.emptyBody : t.discover.noResultsBody}
            />
          }
          ListFooterComponent={
            <View style={{ alignItems: "center", gap: 12, paddingTop: 24, marginTop: 8, borderTopWidth: 1, borderColor: colors.border }}>
              <View style={[rowDir(lang), { alignItems: "center", gap: 8, paddingTop: 16 }]}>
                <ZelligeMark size={16} radius={5} />
                <T lang={lang} weight="semibold" size={12} color={colors.mutedSoft} style={{ flexShrink: 1, textAlign: "center" }}>
                  {t.discover.scanInstead}
                </T>
              </View>
              <Pressable onPress={() => go("/", "replace")}>
                <T lang={lang} weight="bold" size={12.5} color={colors.muted}>
                  {t.landing.scanPrompt}
                </T>
              </Pressable>
            </View>
          }
          renderItem={({ item: { venue, dist } }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={venue.name}
              onPress={() => go(`/r/${venue.slug}`)}
              style={[
                rowDir(lang),
                {
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 18,
                  overflow: "hidden",
                  alignItems: "stretch",
                },
              ]}
            >
              <PhotoPlaceholder width={104} height={104} radius={0} mirrored={isRtl} />
              <View style={{ flex: 1, padding: 14, gap: 4, justifyContent: "center" }}>
                <View style={[rowDir(lang), { justifyContent: "space-between", alignItems: "flex-start", gap: 8 }]}>
                  <T lang={lang} display size={17} numberOfLines={1} style={{ flexShrink: 1, ...align }}>
                    {venue.name}
                  </T>
                  {venue.plan === "pro" && (
                    <View style={{ backgroundColor: colors.harissaTint, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <T weight="extrabold" size={10} color={colors.harissaPressed}>
                        PRO
                      </T>
                    </View>
                  )}
                </View>
                <T lang={lang} size={12.5} color={colors.muted} numberOfLines={1} style={align}>
                  {tr(venue.tagline_i18n)}
                </T>
                <View style={[rowDir(lang), { alignItems: "center", gap: 6 }]}>
                  <T lang={lang} weight="semibold" size={12} color={colors.mutedSoft} numberOfLines={1} style={{ flexShrink: 1 }}>
                    {venue.city}
                  </T>
                  {dist != null && (
                    <>
                      <T size={12} color={colors.mutedSoft}>
                        ·
                      </T>
                      <T lang={lang} weight="semibold" size={12} color={colors.sidiBouPressed}>
                        {interpolate(t.discover.away, { d: formatDistanceKm(dist, lang) })}
                      </T>
                    </>
                  )}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function EmptyState({ lang, title, body }: { lang: Language; title: string; body: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 60 }}>
      <ZelligeMark size={40} />
      <T lang={lang} display size={20} style={{ marginTop: 8, textAlign: "center" }}>
        {title}
      </T>
      <T lang={lang} weight="semibold" size={13} color={colors.muted} style={{ textAlign: "center", maxWidth: 280 }}>
        {body}
      </T>
    </View>
  );
}
