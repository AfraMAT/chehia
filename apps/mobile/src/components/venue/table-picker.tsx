import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Handle, SheetClose, T } from "../ui";
import { useI18n } from "@/lib/i18n";
import { colors, rowDir } from "@/lib/theme";
import { useVenue, type TableChoice } from "@/lib/venue";

/**
 * Bottom sheet to choose a table in the browse flow. Groups the venue's tables
 * by zone. Selecting one attaches it to the cart (no qr_token needed — the order
 * is placed by table_id).
 */
export function TablePicker({ onClose }: { onClose: () => void }) {
  const { tables, setTable, table } = useVenue();
  const { t, lang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();

  const byZone = new Map<string, TableChoice[]>();
  for (const tb of tables ?? []) {
    const zone = tb.zone || "";
    (byZone.get(zone) ?? byZone.set(zone, []).get(zone)!).push(tb);
  }

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(34,26,19,0.45)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close} />
        <View
          style={{
            maxHeight: "86%",
            backgroundColor: colors.cream,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            paddingTop: 12,
            overflow: "hidden",
          }}
        >
          <SheetClose onClose={onClose} isRtl={isRtl} />
          <View style={{ paddingHorizontal: 20 }}>
            <Handle />
            <T lang={lang} display size={22} style={{ textAlign: isRtl ? "right" : "left" }}>
              {t.landing.tablePickerTitle}
            </T>
            <T lang={lang} weight="semibold" size={13} color={colors.muted} style={{ textAlign: isRtl ? "right" : "left" }}>
              {t.landing.tablePickerBody}
            </T>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 16 }}>
            {(tables ?? []).length === 0 && (
              <T lang={lang} weight="semibold" size={14} color={colors.muted} style={{ paddingVertical: 40, textAlign: "center" }}>
                {t.landing.noTables}
              </T>
            )}
            {[...byZone.entries()].map(([zone, list]) => (
              <View key={zone || "_"} style={{ gap: 8 }}>
                {zone ? (
                  <T weight="bold" size={12} color={colors.mutedSoft} style={{ letterSpacing: 0.5, textAlign: isRtl ? "right" : "left" }}>
                    {zone.toUpperCase()}
                  </T>
                ) : null}
                <View style={[rowDir(lang), { flexWrap: "wrap", gap: 8 }]}>
                  {list.map((tb) => {
                    const active = table?.id === tb.id;
                    return (
                      <Pressable
                        key={tb.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${t.common.table} ${tb.label}`}
                        onPress={() => {
                          setTable(tb);
                          onClose();
                        }}
                        style={{
                          width: 64,
                          height: 56,
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: active ? colors.ink : colors.borderStrong,
                          backgroundColor: active ? colors.ink : "#FFFFFF",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <T display size={18} color={active ? colors.cream : colors.ink}>
                          {tb.label}
                        </T>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
