import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  currencyLabel,
  formatClock,
  interpolate,
  millimesToDisplay,
  trackingStep,
  type Language,
  type Order,
  type OrderItem,
} from "@chehia/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BackButton, CtaButton, Line, T } from "../ui";
import { WaiterSheet } from "./waiter-sheet";
import { RatingSheet } from "./rating-sheet";
import { useI18n } from "@/lib/i18n";
import { go } from "@/lib/nav";
import { colors, rowDir } from "@/lib/theme";
import { ensureCustomerSession, supabase } from "@/lib/supabase";
import { useVenue } from "@/lib/venue";

/**
 * P5/P9 · Order tracking — realtime status, animated preparing state, waiter one
 * tap away. Shared by the scanned and browse flows; the menu route is derived
 * from the provider's basePath. Render only under a "ready" venue guard.
 */
export function OrderScreen({ orderId }: { orderId: string }) {
  const { restaurant, table, basePath, activeOrder, forgetOrder, online } = useVenue();
  const { t, tr, lang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderItem[]>([]);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const ratingPromptedRef = useRef(false);
  const reviewsOn = restaurant.reviews_enabled !== false;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Distinct from loadFailed (genuine not-found): the order could not be loaded
  // at all — offline on a cold-start, or the realtime socket never connected.
  // Surfaces an escapable screen so the spinner can never trap the customer.
  const [loadStalled, setLoadStalled] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Bumped by a 30s interval while the order is open, so the rough ETA re-renders
  // and ticks down instead of freezing at the value computed on first paint.
  const [, setTick] = useState(0);

  // Initial fetch only fills empty state; a refetch on channel join closes
  // the pre-subscription gap so a stale fetch can't mask a newer status.
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchOrder = async (overwrite: boolean) => {
      const { data: o, error } = await supabase.from("orders").select("*").eq("id", String(orderId)).maybeSingle<Order>();
      if (cancelled) return;
      // A transient network/DB error must not look like a missing order — keep
      // the spinner and let the realtime subscribe + refetch recover (the
      // stall timer below is the backstop if recovery never comes).
      if (error) return;
      if (!o) {
        setLoadFailed(true);
        return;
      }
      setLoadFailed(false);
      setLoadStalled(false);
      setOrder((prev) => (overwrite || !prev ? o : prev));
    };

    // Backstop: if nothing loads the order within a few seconds (offline
    // cold-start, blocked/failed realtime socket), stop spinning forever and
    // offer a way out. Cleared the moment a real order arrives.
    const stallTimer = setTimeout(() => {
      if (!cancelled) setLoadStalled(true);
    }, 7000);

    void (async () => {
      // Ensure the anonymous session is loaded before reading under RLS — covers
      // returning to the order after a cold app start, before any other action.
      await ensureCustomerSession().catch(() => {});
      if (cancelled) return;

      void fetchOrder(false);
      const { data: li } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", String(orderId))
        .overrideTypes<OrderItem[], { merge: false }>();
      if (!cancelled) setLines(li ?? []);

      channel = supabase
        .channel(`order-${orderId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
          (payload) => setOrder((prev) => ({ ...(prev as Order), ...(payload.new as Order) })),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void fetchOrder(true);
        });
    })();

    return () => {
      cancelled = true;
      clearTimeout(stallTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [orderId, reloadKey]);

  // Stop tracking once the order is done, so the "return to your order" affordance
  // clears and doesn't surface to the next customer at the same table.
  useEffect(() => {
    if (order && activeOrder?.id === String(orderId) && (order.status === "served" || order.status === "cancelled")) {
      forgetOrder();
    }
  }, [order, activeOrder, orderId, forgetOrder]);

  // Invite a rating once, the moment the order is served — never nag: a persisted
  // flag means it won't reopen on relaunch, but the customer can still tap "Rate".
  useEffect(() => {
    if (order?.status !== "served" || !reviewsOn || lines.length === 0 || ratingPromptedRef.current) return;
    ratingPromptedRef.current = true;
    const key = `chehia.rated.${orderId}`;
    void AsyncStorage.getItem(key).then((seen) => {
      if (!seen) {
        void AsyncStorage.setItem(key, "1");
        setRatingOpen(true);
      }
    });
  }, [order?.status, reviewsOn, lines.length, orderId]);

  // Speak each status transition so a VoiceOver/TalkBack user who set the phone
  // down hears "Ready"/"Served" without re-focusing the text. Skip first mount.
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const s = order?.status;
    if (!s) return;
    const title =
      s === "cancelled" ? t.order.cancelled
      : s === "served" ? t.order.servedTitle
      : s === "ready" ? t.order.ready
      : s === "preparing" ? t.order.preparing
      : t.order.received;
    if (prevStatusRef.current && prevStatusRef.current !== s) {
      AccessibilityInfo.announceForAccessibility(title);
      // A distinct success buzz the moment it's ready, so a customer who set the
      // phone down on the table feels it without watching the screen.
      if (s === "ready") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevStatusRef.current = s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status]);

  // Tick every 30s while the order is still being prepared so the rough ETA
  // stays live. Stops once ready/served/cancelled — no work while nothing counts down.
  const counting = order?.status === "new" || order?.status === "preparing";
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [counting]);

  const count = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const tableLabel = table?.label ?? "";

  if (loadFailed) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: insets.top }}>
        <View style={[rowDir(lang), { alignItems: "center", paddingHorizontal: 20, paddingTop: 12 }]}>
          <BackButton isRtl={isRtl} onPress={() => go(`${basePath}/menu`, "replace")} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 14 }}>
          <T lang={lang} display size={20} style={{ textAlign: "center" }}>
            {t.errors.generic}
          </T>
          <CtaButton lang={lang} height={50} label={t.cart.browseMenu} onPress={() => go(`${basePath}/menu`, "replace")} />
        </View>
      </View>
    );
  }

  if (!order) {
    // Load stalled (offline / socket never connected) → escapable screen with a
    // retry and a way back to the menu, so the spinner can't trap the customer.
    if (loadStalled) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: insets.top }}>
          <View style={[rowDir(lang), { alignItems: "center", paddingHorizontal: 20, paddingTop: 12 }]}>
            <BackButton isRtl={isRtl} onPress={() => go(`${basePath}/menu`, "replace")} />
          </View>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 }}>
            <T lang={lang} display size={20} style={{ textAlign: "center" }}>
              {online ? t.errors.generic : t.errors.network}
            </T>
            {!online && (
              <T lang={lang} weight="semibold" size={13.5} color={colors.muted} style={{ textAlign: "center" }}>
                {t.errors.networkBody}
              </T>
            )}
            <CtaButton
              lang={lang}
              height={50}
              style={{ alignSelf: "stretch" }}
              label={t.offline.retryNow}
              onPress={() => {
                setLoadStalled(false);
                setReloadKey((k) => k + 1);
              }}
            />
            <CtaButton
              lang={lang}
              variant="outline"
              height={50}
              style={{ alignSelf: "stretch" }}
              label={t.cart.browseMenu}
              onPress={() => go(`${basePath}/menu`, "replace")}
            />
          </View>
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.harissa} />
      </View>
    );
  }

  const step = trackingStep(order.status);
  const isServed = order.status === "served";
  const isCancelled = order.status === "cancelled";

  const statusTitle = isCancelled
    ? t.order.cancelled
    : isServed
      ? t.order.servedTitle
      : order.status === "ready"
        ? t.order.ready
        : order.status === "preparing"
          ? t.order.preparing
          : t.order.received;

  const servedInMin =
    order.served_at && order.created_at
      ? Math.max(1, Math.round((new Date(order.served_at).getTime() - new Date(order.created_at).getTime()) / 60000))
      : null;

  const align = { textAlign: (isRtl ? "right" : "left") as "left" | "right" };
  const tableSuffix = tableLabel ? ` · ${t.common.table} ${tableLabel}` : "";

  const remaining = isServed || isCancelled ? null : remainingEstimate(order);
  const statusSubtitle = isServed
    ? t.order.servedSubtitle
    : isCancelled
      ? t.order.cancelledBody
      : order.status === "ready"
        ? `${t.order.readyBody}${tableSuffix}`
        : remaining != null
          ? `${interpolate(t.order.remaining, { min: remaining })}${tableSuffix}`
          : `${t.order.soon}${tableSuffix}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: insets.top }}>
      {/* Header */}
      <View style={[rowDir(lang), { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12 }]}>
        <BackButton isRtl={isRtl} onPress={() => go(`${basePath}/menu`, "replace")} />
        <T lang={lang} weight="extrabold" size={13} color={colors.mutedSoft} style={{ letterSpacing: lang === "ar" ? 0 : 1.5 }}>
          {t.order.order.toUpperCase()} #{order.order_number}
        </T>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}>
        {/* Status hero */}
        <View style={{ alignItems: "center", paddingVertical: 26, gap: 14 }}>
          {isServed ? (
            <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: colors.successTint, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" }}>
                <T weight="extrabold" size={26} color="#FFFFFF">
                  ✓
                </T>
              </View>
            </View>
          ) : isCancelled ? (
            <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: colors.dangerTint, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" }}>
                <T weight="extrabold" size={24} color="#FFFFFF">
                  ✕
                </T>
              </View>
            </View>
          ) : (
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.warningTint, alignItems: "center", justifyContent: "center" }}>
              <View style={[rowDir(lang), { gap: 5, alignItems: "flex-end" }]}>
                <View style={{ width: 9, height: 22, borderRadius: 4, backgroundColor: colors.warning }} />
                <View style={{ width: 9, height: 30, borderRadius: 4, backgroundColor: colors.warning }} />
                <View style={{ width: 9, height: 16, borderRadius: 4, backgroundColor: colors.warning }} />
              </View>
            </View>
          )}
          <View
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${statusTitle}. ${statusSubtitle}`}
            style={{ alignItems: "center", gap: 3, paddingHorizontal: 24 }}
          >
            <T lang={lang} display size={30} style={{ textAlign: "center" }}>
              {statusTitle}
            </T>
            <T lang={lang} weight="semibold" size={14} color={colors.muted} style={{ textAlign: "center" }}>
              {statusSubtitle}
            </T>
          </View>
        </View>

        {isServed ? (
          /* Receipt recap (P9) */
          <View
            style={{
              marginHorizontal: 20,
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 18,
              padding: 17,
              gap: 10,
            }}
          >
            <View style={[rowDir(lang), { justifyContent: "space-between", alignItems: "center", paddingBottom: 10 }]}>
              <T lang={lang} weight="extrabold" size={13} color={colors.mutedSoft} style={{ letterSpacing: lang === "ar" ? 0 : 0.8 }}>
                {tableLabel ? `${t.common.table.toUpperCase()} ${tableLabel} · ` : ""}
                {formatClock(new Date(order.served_at ?? order.created_at), lang)}
              </T>
              {servedInMin && (
                <View style={{ backgroundColor: colors.successTint, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <T weight="extrabold" size={11} color={colors.successText}>
                    {interpolate(t.order.servedIn, { min: servedInMin })}
                  </T>
                </View>
              )}
            </View>
            <Line dashed />
            {lines.map((line) => (
              <View key={line.id} style={[rowDir(lang), { justifyContent: "space-between", gap: 8 }]}>
                <T lang={lang} weight="bold" size={14} style={{ flexShrink: 1, ...align }}>
                  {line.qty}× {tr(line.name_snapshot)}
                  {line.modifiers_snapshot.length > 0 && (
                    <T lang={lang} weight="semibold" size={13} color={colors.mutedSoft}>
                      {" "}
                      — {line.modifiers_snapshot.map((m) => tr(m.choice)).join(", ")}
                    </T>
                  )}
                </T>
                <T weight="bold" size={14}>
                  {millimesToDisplay(line.unit_price_millimes * line.qty, lang)}
                </T>
              </View>
            ))}
            <Line dashed />
            <View style={[rowDir(lang), { justifyContent: "space-between", alignItems: "baseline", paddingTop: 2 }]}>
              <T lang={lang} weight="extrabold" size={15}>
                {t.common.total}
              </T>
              <T display size={22}>
                {millimesToDisplay(order.total_millimes, lang)}{" "}
                <T weight="bold" size={12} color={colors.mutedSoft} lang={lang}>
                  {currencyLabel(lang)}
                </T>
              </T>
            </View>
          </View>
        ) : (
          !isCancelled && (
            <>
              {/* Timeline (P5) */}
              <View
                style={{
                  marginHorizontal: 20,
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <TimelineRow
                  state={step >= 1 ? "done" : "active"}
                  title={t.order.received}
                  body={`${formatClock(new Date(order.created_at), lang)} — ${t.order.receivedBody}`}
                  hasLine
                  lineActive={step >= 1}
                  isRtl={isRtl}
                  lang={lang}
                />
                <TimelineRow
                  state={step >= 2 ? "done" : step === 1 ? "active" : "pending"}
                  title={order.status === "ready" ? t.order.ready : t.order.preparing}
                  body={order.status === "ready" ? t.order.readyBody : t.order.preparingBody}
                  hasLine
                  lineActive={step >= 2}
                  isRtl={isRtl}
                  lang={lang}
                />
                <TimelineRow
                  state={step >= 2 ? "done" : "pending"}
                  title={t.order.served}
                  body={t.order.servedBody}
                  isRtl={isRtl}
                  lang={lang}
                />
              </View>

              {/* Order summary (collapsible) */}
              <Pressable
                onPress={() => setDetailsOpen((v) => !v)}
                accessible
                accessibilityRole="button"
                accessibilityState={{ expanded: detailsOpen }}
                accessibilityLabel={`${count} ${t.common.items} · ${millimesToDisplay(order.total_millimes, lang)} ${currencyLabel(lang)}`}
                style={[
                  rowDir(lang),
                  {
                    marginHorizontal: 20,
                    marginTop: 12,
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  },
                ]}
              >
                <View style={{ flexShrink: 1 }}>
                  <T lang={lang} weight="extrabold" size={14} style={align}>
                    {count} {t.common.items} · {millimesToDisplay(order.total_millimes, lang)} {currencyLabel(lang)}
                  </T>
                  <T lang={lang} weight="semibold" size={12} color={colors.mutedSoft} numberOfLines={1} style={align}>
                    {lines.map((l) => `${l.qty}× ${tr(l.name_snapshot)}`).join(", ")}
                  </T>
                </View>
                <T weight="extrabold" size={16} color={colors.mutedSoft}>
                  {detailsOpen ? "⌃" : "⌄"}
                </T>
              </Pressable>
              {detailsOpen && (
                <View
                  style={{
                    marginHorizontal: 20,
                    marginTop: 8,
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    padding: 16,
                    gap: 8,
                  }}
                >
                  {lines.map((line) => (
                    <View key={line.id} style={[rowDir(lang), { justifyContent: "space-between", gap: 8 }]}>
                      <T lang={lang} weight="bold" size={13} style={{ flexShrink: 1, ...align }}>
                        {line.qty}× {tr(line.name_snapshot)}
                        {line.modifiers_snapshot.length > 0 && (
                          <T lang={lang} weight="semibold" size={12} color={colors.mutedSoft}>
                            {" "}
                            — {line.modifiers_snapshot.map((m) => tr(m.choice)).join(", ")}
                          </T>
                        )}
                      </T>
                      <T weight="bold" size={13}>
                        {millimesToDisplay(line.unit_price_millimes * line.qty, lang)}
                      </T>
                    </View>
                  ))}
                </View>
              )}
            </>
          )
        )}

        <View style={{ flex: 1, minHeight: 24 }} />

        {/* Actions */}
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {isServed ? (
            <>
              {reviewsOn && (
                <CtaButton lang={lang} height={54} label={`🌟  ${t.rating.rateCta}`} onPress={() => setRatingOpen(true)} />
              )}
              <CtaButton
                lang={lang}
                variant={reviewsOn ? "secondary" : "primary"}
                height={reviewsOn ? 48 : 54}
                label={t.order.orderAgain}
                onPress={() => go(`${basePath}/menu`, "replace")}
              />
              <CtaButton lang={lang} variant="outline" height={48} label={t.waiter.call} onPress={() => setWaiterOpen(true)} />
            </>
          ) : (
            <>
              <CtaButton lang={lang} variant="outline" height={52} label={t.waiter.call} onPress={() => setWaiterOpen(true)} />
              <CtaButton
                lang={lang}
                variant="secondary"
                height={46}
                label={t.order.orderMore}
                onPress={() => go(`${basePath}/menu`, "replace")}
              />
            </>
          )}
        </View>
        <View style={{ height: insets.bottom + 8 }} />
      </ScrollView>

      {waiterOpen && <WaiterSheet onClose={() => setWaiterOpen(false)} />}
      {ratingOpen && <RatingSheet orderId={orderId} lines={lines} onClose={() => setRatingOpen(false)} />}
    </View>
  );
}

/**
 * Rough countdown from a ~8 min baseline. Returns null once the estimate would
 * fall to zero (or the device clock is skewed out of a sane band) so the UI can
 * fall back to an honest status phrase instead of freezing at a fake "~1 min".
 */
function remainingEstimate(order: Order): number | null {
  const remaining = Math.round(8 - (Date.now() - new Date(order.created_at).getTime()) / 60000);
  return remaining >= 1 && remaining <= 8 ? remaining : null;
}

function TimelineRow({
  state,
  title,
  body,
  hasLine = false,
  lineActive = false,
  isRtl,
  lang,
}: {
  state: "done" | "active" | "pending";
  title: string;
  body: string;
  hasLine?: boolean;
  lineActive?: boolean;
  isRtl: boolean;
  lang: Language;
}) {
  return (
    <View style={[rowDir(lang), { gap: 14 }]}>
      <View style={{ alignItems: "center" }}>
        {state === "done" ? (
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.sidiBou, alignItems: "center", justifyContent: "center" }}>
            <T weight="extrabold" size={13} color="#FFFFFF">
              ✓
            </T>
          </View>
        ) : state === "active" ? (
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.warning, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" }} />
          </View>
        ) : (
          <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.borderStrong }} />
        )}
        {hasLine && <View style={{ width: 2, flex: 1, marginVertical: 4, backgroundColor: lineActive ? colors.sidiBou : colors.borderStrong }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: hasLine ? 18 : 0, gap: 1 }}>
        <T
          lang={lang}
          weight="extrabold"
          size={14.5}
          color={state === "done" ? colors.ink : state === "active" ? colors.warningText : colors.disabled}
          style={{ textAlign: isRtl ? "right" : "left" }}
        >
          {title}
        </T>
        <T
          lang={lang}
          weight="semibold"
          size={12.5}
          color={state === "pending" ? colors.disabled : colors.mutedSoft}
          style={{ textAlign: isRtl ? "right" : "left" }}
        >
          {body}
        </T>
      </View>
    </View>
  );
}
