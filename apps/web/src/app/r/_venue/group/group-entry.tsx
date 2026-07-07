"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { interpolate } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { useSession } from "./session-provider";
import { GroupSheet } from "./group-sheet";
import { GroupCart } from "./group-cart";

/** Menu entry point for group ordering (scanned tables only). */
export function GroupEntry({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const { session, available, activeParticipants } = useSession();
  const params = useSearchParams();
  const [sheet, setSheet] = useState(false);
  const [cart, setCart] = useState(false);
  const [joinCode, setJoinCode] = useState<string | undefined>(undefined);

  // Deep link: /r/.../menu?s=CODE offers to join that session.
  useEffect(() => {
    const code = params.get("s");
    if (code && !session) {
      setJoinCode(code);
      setSheet(true);
    }
  }, [params, session]);

  if (!available) return null;

  return (
    <>
      {session ? (
        <button
          type="button"
          onClick={() => setCart(true)}
          className={`${className} w-[calc(100%-2.5rem)] flex items-center gap-2.5 bg-teal-tint border border-teal/30 rounded-xl px-3.5 py-2.5 text-start cursor-pointer hover:border-teal transition-colors`}
        >
          <span aria-hidden className="text-[17px]">👥</span>
          <div className="flex-1 min-w-0">
            <span className="block font-extrabold text-[13.5px] text-teal-pressed">{t.group.groupOrder}</span>
            <span className="block text-[12px] text-teal-pressed/80">{interpolate(t.group.membersCount, { n: activeParticipants.length })}</span>
          </div>
          <span aria-hidden className="text-teal-pressed font-extrabold rtl:rotate-180">›</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setSheet(true)}
          className={`${className} w-[calc(100%-2.5rem)] flex items-center gap-2.5 bg-card border border-line rounded-xl px-3.5 py-2.5 text-start cursor-pointer hover:border-teal transition-colors`}
        >
          <span aria-hidden className="text-[17px]">👥</span>
          <div className="flex-1 min-w-0">
            <span className="block font-extrabold text-[13.5px] text-ink">{t.group.orderTogether}</span>
            <span className="block text-[12px] text-muted-soft">{t.group.orderTogetherHint}</span>
          </div>
        </button>
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
