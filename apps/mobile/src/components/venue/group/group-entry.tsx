import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { interpolate } from "@chehia/shared";
import { T } from "../../ui";
import { useI18n } from "@/lib/i18n";
import { rowDir, useTheme } from "@/lib/theme";
import { useSession } from "@/lib/session";
import { GroupSheet } from "./group-sheet";
import { GroupCart } from "./group-cart";

/** Menu entry point for group ordering (scanned tables only; self-hides otherwise). */
export function GroupEntry({ style }: { style?: object }) {
  const { t, lang, isRtl } = useI18n();
  const theme = useTheme();
  const { session, available, activeParticipants } = useSession();
  const params = useLocalSearchParams<{ s?: string }>();
  const [sheet, setSheet] = useState(false);
  const [cart, setCart] = useState(false);
  const [joinCode, setJoinCode] = useState<string | undefined>(undefined);

  // Deep link: /r/.../menu?s=CODE offers to join that session.
  useEffect(() => {
    const code = typeof params.s === "string" ? params.s : undefined;
    if (code && !session) {
      setJoinCode(code);
      setSheet(true);
    }
  }, [params.s, session]);

  if (!available) return null;

  return (
    <>
      {session ? (
        <Pressable
          onPress={() => setCart(true)}
          accessibilityRole="button"
          accessibilityLabel={t.group.groupOrder}
          style={[
            rowDir(lang),
            style,
            {
              alignItems: "center",
              gap: 10,
              backgroundColor: theme.sidiBouTint,
              borderWidth: 1,
              borderColor: theme.sidiBou,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
            },
          ]}
        >
          <T size={17}>👥</T>
          <View style={{ flex: 1 }}>
            <T lang={lang} weight="extrabold" size={13.5} color={theme.sidiBouPressed} style={{ textAlign: isRtl ? "right" : "left" }}>
              {t.group.groupOrder}
            </T>
            <T lang={lang} weight="semibold" size={12} color={theme.sidiBouPressed} style={{ textAlign: isRtl ? "right" : "left" }}>
              {interpolate(t.group.membersCount, { n: activeParticipants.length })}
            </T>
          </View>
          <T weight="extrabold" size={16} color={theme.sidiBouPressed}>
            {isRtl ? "‹" : "›"}
          </T>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setSheet(true)}
          accessibilityRole="button"
          accessibilityLabel={t.group.orderTogether}
          style={[
            rowDir(lang),
            style,
            {
              alignItems: "center",
              gap: 10,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
            },
          ]}
        >
          <T size={17}>👥</T>
          <View style={{ flex: 1 }}>
            <T lang={lang} weight="extrabold" size={13.5} style={{ textAlign: isRtl ? "right" : "left" }}>
              {t.group.orderTogether}
            </T>
            <T lang={lang} weight="semibold" size={12} color={theme.mutedSoft} style={{ textAlign: isRtl ? "right" : "left" }}>
              {t.group.orderTogetherHint}
            </T>
          </View>
        </Pressable>
      )}

      {sheet && (
        <GroupSheet
          initialCode={joinCode}
          onClose={() => setSheet(false)}
          onJoined={() => {
            setSheet(false);
            setCart(true);
          }}
        />
      )}
      {cart && <GroupCart onClose={() => setCart(false)} />}
    </>
  );
}
