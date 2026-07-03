import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildLine,
  currencyLabel,
  formatDelta,
  millimesToDisplay,
  validateModifiers,
  type MenuItem,
} from "@chehia/shared";
import { CtaButton, PhotoPlaceholder, Stepper, T, TagPill } from "../ui";
import { useI18n } from "@/lib/i18n";
import { colors, rowDir } from "@/lib/theme";
import { useVenue } from "@/lib/venue";

/** P3 · Item detail sheet — required vs optional groups, live price CTA, allergens. */
export function ItemSheet({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const { groupsByItem, addToCart } = useVenue();
  const { t, tr, lang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();

  const groups = useMemo(
    () => [...(groupsByItem[item.id] ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [groupsByItem, item.id],
  );

  const [selected, setSelected] = useState<string[]>(() =>
    groups.filter((g) => g.min_select >= 1 && g.max_select === 1 && g.modifiers[0]).map((g) => g.modifiers[0]!.id),
  );
  const [qty, setQty] = useState(1);
  const [touched, setTouched] = useState(false);

  const validation = validateModifiers(groups, selected);
  const line = buildLine(item, groups, selected, qty);
  const totalLabel = `${millimesToDisplay(line.unitPriceMillimes * qty, lang)} ${currencyLabel(lang)}`;

  const toggleModifier = (groupId: string, modId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setSelected((prev) => {
      const inGroup = group.modifiers.map((m) => m.id);
      if (group.max_select === 1) {
        const cleared = prev.filter((id) => !inGroup.includes(id));
        return prev.includes(modId) && group.min_select === 0 ? cleared : [...cleared, modId];
      }
      if (prev.includes(modId)) return prev.filter((id) => id !== modId);
      if (prev.filter((id) => inGroup.includes(id)).length >= group.max_select) return prev;
      return [...prev, modId];
    });
  };

  const submit = () => {
    setTouched(true);
    if (!validation.ok) return;
    addToCart(buildLine(item, groups, selected, qty));
    onClose();
  };

  const allergenLabels = item.allergens.map((a) => (t.allergens as Record<string, string>)[a] ?? a).join(", ");

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(34,26,19,0.45)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close} />
        <View
          style={{
            maxHeight: "92%",
            backgroundColor: colors.cream,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            overflow: "hidden",
          }}
        >
          {/* Photo */}
          <View>
            <PhotoPlaceholder width="100%" height={180} radius={0} mirrored={isRtl} />
            <Pressable
              accessibilityLabel={t.common.close}
              onPress={onClose}
              style={{
                position: "absolute",
                top: 14,
                [isRtl ? "right" : "left"]: 16,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(34,26,19,0.82)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T weight="extrabold" size={15} color={colors.cream}>
                ✕
              </T>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* Title + price */}
            <View style={{ gap: 4 }}>
              <View style={[rowDir(lang), { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                <T lang={lang} display size={26} style={{ flexShrink: 1, textAlign: isRtl ? "right" : "left" }}>
                  {tr(item.name_i18n)}
                </T>
                <T display size={22}>
                  {millimesToDisplay(item.price_millimes, lang)}{" "}
                  <T weight="bold" size={12} color={colors.mutedSoft} lang={lang}>
                    {currencyLabel(lang)}
                  </T>
                </T>
              </View>
              <T lang={lang} size={13.5} color={colors.muted} style={{ textAlign: isRtl ? "right" : "left" }}>
                {tr(item.description_i18n)}
              </T>
              <View style={[rowDir(lang), { gap: 6, marginTop: 2, flexWrap: "wrap" }]}>
                {item.dietary_tags.includes("vegetarian") && <TagPill lang={lang} label={t.dietary.vegetarian} tone="green" />}
                {item.dietary_tags.includes("spicy") && <TagPill lang={lang} label={t.dietary.spicy} tone="amber" />}
                {allergenLabels ? <TagPill lang={lang} label={`${t.item.allergens} : ${allergenLabels}`} tone="neutral" /> : null}
              </View>
            </View>

            {/* Groups */}
            {groups.map((group) => {
              const isRequired = group.min_select >= 1;
              const isMissing = touched && validation.missingGroups.includes(group.id);
              const multi = group.max_select > 1;
              return (
                <View key={group.id} style={{ gap: 8 }}>
                  <View style={[rowDir(lang), { justifyContent: "space-between", alignItems: "center" }]}>
                    <T lang={lang} weight="extrabold" size={14}>
                      {tr(group.name_i18n)}
                      {!isRequired && (
                        <T lang={lang} weight="semibold" size={12} color={colors.mutedSoft}>
                          {" "}
                          · {t.common.optional}
                        </T>
                      )}
                    </T>
                    {isRequired && (
                      <View
                        style={{
                          backgroundColor: isMissing ? colors.dangerTint : colors.harissaTint,
                          borderRadius: 100,
                          paddingHorizontal: 9,
                          paddingVertical: 3,
                        }}
                      >
                        <T lang={lang} weight="bold" size={11} color={isMissing ? colors.dangerText : colors.harissaPressed}>
                          {t.common.required}
                        </T>
                      </View>
                    )}
                  </View>

                  {multi ? (
                    <View style={{ gap: 7 }}>
                      {group.modifiers.map((mod) => {
                        const active = selected.includes(mod.id);
                        return (
                          <Pressable
                            key={mod.id}
                            onPress={() => toggleModifier(group.id, mod.id)}
                            style={[
                              rowDir(lang),
                              {
                                alignItems: "center",
                                gap: 11,
                                backgroundColor: active ? colors.harissaTint : "#FFFFFF",
                                borderWidth: active ? 2 : 1.5,
                                borderColor: active ? colors.harissa : colors.borderStrong,
                                borderRadius: 13,
                                paddingVertical: 11,
                                paddingHorizontal: 13,
                              },
                            ]}
                          >
                            <View
                              style={{
                                width: 21,
                                height: 21,
                                borderRadius: 7,
                                borderWidth: active ? 0 : 2,
                                borderColor: colors.disabled,
                                backgroundColor: active ? colors.harissa : "transparent",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {active && (
                                <T weight="extrabold" size={12} color="#FFFFFF">
                                  ✓
                                </T>
                              )}
                            </View>
                            <T lang={lang} weight="bold" size={13.5} color={active ? colors.harissaPressed : colors.ink} style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
                              {tr(mod.name_i18n)}
                            </T>
                            <T weight="bold" size={12.5} color={colors.muted}>
                              {formatDelta(mod.price_delta_millimes, lang)}
                            </T>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={[rowDir(lang), { gap: 7, flexWrap: "wrap" }]}>
                      {group.modifiers.map((mod) => {
                        const active = selected.includes(mod.id);
                        const hasDelta = mod.price_delta_millimes !== 0;
                        const blockStyle = hasDelta || group.modifiers.length <= 3;
                        return (
                          <Pressable
                            key={mod.id}
                            onPress={() => toggleModifier(group.id, mod.id)}
                            style={{
                              flexGrow: blockStyle ? 1 : 0,
                              minWidth: blockStyle ? 72 : undefined,
                              height: blockStyle ? 52 : 38,
                              paddingHorizontal: blockStyle ? 8 : 15,
                              borderRadius: blockStyle ? 14 : 100,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: active ? (blockStyle ? colors.harissaTint : colors.ink) : "#FFFFFF",
                              borderWidth: active && blockStyle ? 2 : active ? 0 : 1.5,
                              borderColor: active ? colors.harissa : colors.borderStrong,
                            }}
                          >
                            <T
                              lang={lang}
                              weight="extrabold"
                              size={blockStyle ? 14 : 13}
                              color={active ? (blockStyle ? colors.harissaPressed : colors.cream) : colors.ink}
                            >
                              {tr(mod.name_i18n)}
                            </T>
                            {hasDelta && (
                              <T weight="bold" size={11} color={active ? colors.harissaPressed : colors.mutedSoft}>
                                {formatDelta(mod.price_delta_millimes, lang)}
                              </T>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
            {touched && !validation.ok && (
              <T lang={lang} weight="bold" size={13} color={colors.dangerText}>
                {t.item.chooseRequired}
              </T>
            )}
          </ScrollView>

          {/* Footer */}
          <View
            style={[
              rowDir(lang),
              {
                gap: 12,
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: insets.bottom + 14,
                backgroundColor: colors.card,
                borderTopWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
              },
            ]}
          >
            <Stepper value={qty} onChange={setQty} min={1} max={20} />
            <CtaButton
              lang={lang}
              style={{ flex: 1 }}
              height={52}
              label={`${t.item.addToCart} · ${totalLabel}`}
              onPress={submit}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
