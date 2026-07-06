import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  formatDistanceKm,
  formatRating,
  haversineKm,
  interpolate,
  LANGUAGE_LABELS,
  LANGUAGES,
  type Coords,
  type DiscoveryVenue,
  type Language,
} from "@chehia/shared";
import { CtaButton, PhotoPlaceholder, Stars, T, Wordmark, ZelligeMark } from "./ui";
import { useI18n } from "@/lib/i18n";
import { go } from "@/lib/nav";
import { supabase } from "@/lib/supabase";
import { colors, rowDir } from "@/lib/theme";

type GeoState = "idle" | "locating" | "on" | "denied" | "unavailable";

/**
 * Consumer discovery — find a venue by name or near you, then browse & order.
 * Mirrors apps/web discover.tsx: active-venue list, search, distance sort.
 *
 * "Near me" uses expo-location: it requests foreground permission, reads the
 * current position, and sorts venues by Haversine distance. Permission denied
 * → `locationOff`; a failed read or an unavailable native module (e.g. a bare
 * Expo Go) → `locationUnavailable`. Distance sorting stays off until coords exist.
 */
export function Discover() {
  const { t, tr, lang, setLang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();
  const [venues, setVenues] = useState<DiscoveryVenue[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");

  const load = useCallback(async () => {
    setLoadError(false);
    const { data, error } = await supabase
      .from("restaurants")
      // select("*") not an explicit list: if this build runs against a backend
      // where the reviews migration hasn't landed (rating_avg/rating_count
      // absent), an explicit column name would hard-error (PostgREST 400) and
      // brick discovery. select("*") returns whatever exists; the rating UI is
      // guarded on rating_count, so ratings stay hidden until the columns exist.
      .select("*")
      .eq("is_active", true)
      .order("name")
      .overrideTypes<DiscoveryVenue[], { merge: false }>();
    // A transient failure must not read as "no restaurants" — keep the list null
    // and surface a retry instead of a misleading empty state.
    if (error) {
      setLoadError(true);
      return;
    }
    setVenues(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const locate = useCallback(async () => {
    setGeo("locating");
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setCoords(null);
        setGeo("denied");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setGeo("on");
    } catch {
      // Position read failed or the native module is unavailable — degrade
      // gracefully; search-by-name discovery still works.
      setCoords(null);
      setGeo("unavailable");
    }
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
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
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
          onPress={() => void locate()}
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

      {(geo === "denied" || geo === "unavailable") && (
        <T lang={lang} weight="semibold" size={12.5} color={colors.mutedSoft} style={{ paddingHorizontal: 20, paddingTop: 8, ...align }}>
          {geo === "unavailable" ? t.discover.locationUnavailable : t.discover.locationOff}
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
        loadError ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 }}>
            <T lang={lang} display size={20} style={{ textAlign: "center" }}>
              {t.errors.generic}
            </T>
            <T lang={lang} weight="semibold" size={13.5} color={colors.muted} style={{ textAlign: "center" }}>
              {t.errors.genericBody}
            </T>
            <CtaButton lang={lang} height={50} label={t.offline.retryNow} onPress={() => void load()} style={{ alignSelf: "stretch" }} />
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.harissa} size="large" />
          </View>
        )
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
              <PhotoPlaceholder width={104} height={104} radius={0} mirrored={isRtl} src={venue.cover_url} />
              <View style={{ flex: 1, padding: 14, gap: 4, justifyContent: "center" }}>
                <View style={[rowDir(lang), { justifyContent: "space-between", alignItems: "flex-start", gap: 8 }]}>
                  {/* No plan/tier badge — "PRO" is internal billing, meaningless to a guest. */}
                  <T lang={lang} display size={17} numberOfLines={1} style={{ flexShrink: 1, ...align }}>
                    {venue.name}
                  </T>
                </View>
                <T lang={lang} size={12.5} color={colors.muted} numberOfLines={1} style={align}>
                  {tr(venue.tagline_i18n)}
                </T>
                <View style={[rowDir(lang), { alignItems: "center", gap: 6 }]}>
                  {(venue.rating_count ?? 0) > 0 && (
                    <>
                      <View style={[rowDir(lang), { alignItems: "center", gap: 4 }]}>
                        <Stars value={venue.rating_avg} size={12} />
                        <T lang={lang} weight="bold" size={12} color={colors.ink}>
                          {formatRating(venue.rating_avg, lang)}
                        </T>
                      </View>
                      <T size={12} color={colors.mutedSoft}>·</T>
                    </>
                  )}
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
