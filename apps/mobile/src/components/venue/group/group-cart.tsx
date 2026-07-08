import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { currencyLabel, formatPrice, millimesToDisplay } from "@chehia/shared";
import { CtaButton, SheetClose, Stepper, T } from "../../ui";
import { useI18n } from "@/lib/i18n";
import { go } from "@/lib/nav";
import { colors, rowDir, useTheme } from "@/lib/theme";
import { useVenue } from "@/lib/venue";
import { useSession } from "@/lib/session";

/** Customer web host for the join deep link (same scheme the table QR encodes). */
const SHARE_HOST = "https://chehia.app";

/** The shared group cart: participants, attributed lines, ready state, placement. */
export function GroupCart({ onClose }: { onClose: () => void }) {
  const { t, tr, lang, isRtl } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { items, groupsByItem, basePath, rememberOrder } = useVenue();
  const {
    session,
    lines,
    activeParticipants,
    myParticipantId,
    isHost,
    amReady,
    allReady,
    setReady,
    setLineQty,
    placeGroup,
    placeSolo,
    leave,
  } = useSession();
  const [busy, setBusy] = useState<"group" | "solo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const unitOf = (itemId: string, modifierIds: string[]): number => {
    const item = itemById.get(itemId);
    if (!item) return 0;
    let delta = 0;
    for (const g of groupsByItem[itemId] ?? []) for (const m of g.modifiers) if (modifierIds.includes(m.id)) delta += m.price_delta_millimes;
    return item.price_millimes + delta;
  };

  const myLines = lines.filter((l) => l.participant_id === myParticipantId);
  const groupTotal = lines.reduce((s, l) => s + unitOf(l.item_id, l.modifier_ids) * l.qty, 0);
  const myTotal = myLines.reduce((s, l) => s + unitOf(l.item_id, l.modifier_ids) * l.qty, 0);

  if (!session) return null;

  const shareLink = `${SHARE_HOST}${basePath}/menu?s=${session.share_code}`;

  const share = async () => {
    try {
      await Share.share({ message: `${t.group.shareHint} ${shareLink}`, url: shareLink });
    } catch {
      // user dismissed / share unavailable — no-op
    }
  };

  const doPlace = async (mode: "group" | "solo") => {
    setBusy(mode);
    setError(null);
    const res = mode === "group" ? await placeGroup() : await placeSolo();
    setBusy(null);
    if (!res.ok) {
      setError(
        res.code === "not_ready"
          ? t.group.errorNotReady
          : res.code === "host_only"
            ? t.group.onlyHostPlaces
            : res.code === "session_closed"
              ? t.group.sessionClosed
              : t.errors.generic,
      );
      return;
    }
    if (res.orderId) {
      rememberOrder(res.orderId);
      onClose();
      go(`${basePath}/order/${res.orderId}`, "replace");
    }
  };

  const align = { textAlign: (isRtl ? "right" : "left") as "left" | "right" };

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(34,26,19,0.45)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close} />
        <View
          style={{
            maxHeight: "92%",
            backgroundColor: theme.cream,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            overflow: "hidden",
          }}
        >
          <SheetClose onClose={onClose} isRtl={isRtl} />

          {/* Header */}
          <View style={[rowDir(lang), { alignItems: "center", gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: theme.border }]}>
            <T size={18}>👥</T>
            <T lang={lang} display size={19} style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
              {t.group.groupOrder}
            </T>
          </View>

          {/* Share */}
          <View style={[rowDir(lang), { alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.sidiBouTint }]}>
            <View style={{ flex: 1 }}>
              <T lang={lang} weight="bold" size={11} color={theme.sidiBouPressed} style={align}>
                {t.group.code}
              </T>
              <T display size={18} color={theme.sidiBouPressed} style={{ letterSpacing: 3 }}>
                {session.share_code}
              </T>
            </View>
            <CtaButton lang={lang} variant="dark" height={38} style={{ paddingHorizontal: 16 }} label={t.group.shareVia} onPress={() => void share()} />
          </View>

          {/* Participants + their lines */}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 16 }}>
            {activeParticipants.map((p) => {
              const pLines = lines.filter((l) => l.participant_id === p.id);
              const mine = p.id === myParticipantId;
              return (
                <View key={p.id} style={{ gap: 8 }}>
                  <View style={[rowDir(lang), { alignItems: "center", gap: 8 }]}>
                    <T lang={lang} weight="extrabold" size={14} style={align}>
                      {mine ? t.group.you : p.nickname}
                    </T>
                    {p.is_host && (
                      <View style={{ backgroundColor: theme.sidiBouTint, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <T lang={lang} weight="bold" size={11} color={theme.sidiBouPressed}>
                          {t.group.host}
                        </T>
                      </View>
                    )}
                    <View style={{ flex: 1 }} />
                    <View
                      style={{
                        backgroundColor: p.is_ready ? colors.successTint : theme.sandDeep,
                        borderRadius: 100,
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                      }}
                    >
                      <T lang={lang} weight="extrabold" size={11} color={p.is_ready ? colors.successText : theme.mutedSoft}>
                        {p.is_ready ? `✓ ${t.group.ready}` : t.group.waiting}
                      </T>
                    </View>
                  </View>

                  {pLines.length === 0 ? (
                    <T lang={lang} size={12.5} color={theme.mutedSoft} style={[align, { paddingStart: 2 }]}>
                      {t.group.emptyCart}
                    </T>
                  ) : (
                    pLines.map((l) => {
                      const item = itemById.get(l.item_id);
                      const lineTotal = unitOf(l.item_id, l.modifier_ids) * l.qty;
                      return (
                        <View
                          key={l.id}
                          style={[rowDir(lang), { alignItems: "center", gap: 10, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }]}
                        >
                          <T lang={lang} weight="bold" size={13.5} numberOfLines={1} style={{ flex: 1, ...align }}>
                            {item ? tr(item.name_i18n) : "—"}
                          </T>
                          {mine ? (
                            <Stepper compact value={l.qty} min={0} max={20} onChange={(q) => void setLineQty(l.id, q)} />
                          ) : (
                            <T lang={lang} weight="bold" size={12.5} color={theme.mutedSoft}>
                              ×{l.qty}
                            </T>
                          )}
                          <T weight="extrabold" size={13.5} style={{ minWidth: 58, textAlign: isRtl ? "left" : "right" }}>
                            {millimesToDisplay(lineTotal, lang)}{" "}
                            <T size={10} color={theme.mutedSoft} lang={lang}>
                              {currencyLabel(lang)}
                            </T>
                          </T>
                        </View>
                      );
                    })
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={{ borderTopWidth: 1, borderColor: theme.border, backgroundColor: theme.card, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 14, gap: 10 }}>
            {error && (
              <T lang={lang} weight="bold" size={12.5} color={colors.dangerText} style={{ textAlign: "center" }}>
                {error}
              </T>
            )}

            <View style={[rowDir(lang), { justifyContent: "space-between", alignItems: "baseline" }]}>
              <T lang={lang} weight="bold" size={13} color={theme.muted}>
                {t.common.total}
              </T>
              <T display size={18}>
                {formatPrice(groupTotal, lang)}
              </T>
            </View>

            {/* Ready toggle */}
            <CtaButton
              lang={lang}
              variant={amReady ? "secondary" : "primary"}
              height={46}
              label={amReady ? t.group.notReadyYet : t.group.imReady}
              onPress={() => void setReady(!amReady)}
            />

            {/* Host placement */}
            {isHost ? (
              busy === "group" ? (
                <View style={{ height: 52, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color={theme.harissa} />
                </View>
              ) : (
                <CtaButton
                  lang={lang}
                  height={52}
                  disabled={!allReady || busy !== null}
                  label={t.group.placeGroupOrder}
                  onPress={() => void doPlace("group")}
                />
              )
            ) : (
              <T lang={lang} weight="semibold" size={12.5} color={theme.mutedSoft} style={{ textAlign: "center" }}>
                {allReady ? t.group.allReady : t.group.hostWillPlace}
              </T>
            )}

            {/* Solo split */}
            {busy === "solo" ? (
              <View style={{ height: 46, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color={theme.harissa} />
              </View>
            ) : (
              <CtaButton
                lang={lang}
                variant="outline"
                height={46}
                disabled={busy !== null || myLines.length === 0}
                label={`${t.group.checkoutSolo} · ${millimesToDisplay(myTotal, lang)} ${currencyLabel(lang)}`}
                onPress={() => void doPlace("solo")}
              />
            )}

            <Pressable onPress={() => void leave().then(onClose)} accessibilityRole="button" style={{ height: 36, alignItems: "center", justifyContent: "center" }}>
              <T lang={lang} weight="bold" size={12} color={theme.mutedSoft}>
                {t.group.leave}
              </T>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
