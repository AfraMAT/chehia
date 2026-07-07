"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { callFunction, ensureCustomerSession, getSupabase } from "@/lib/supabase";
import { storageGet, storageRemove, storageSet } from "@/lib/storage";
import { useVenue } from "../venue-provider";

export interface SessionParticipant {
  id: string;
  auth_uid: string;
  nickname: string;
  is_host: boolean;
  is_ready: boolean;
  joined_at: string;
  left_at: string | null;
}

export interface SessionCartLine {
  id: string;
  participant_id: string;
  item_id: string;
  qty: number;
  modifier_ids: string[];
  note: string;
}

interface SessionState {
  id: string;
  share_code: string;
  status: string;
}

interface SessionContextValue {
  /** null when the customer hasn't joined/started a group. */
  session: SessionState | null;
  participants: SessionParticipant[];
  lines: SessionCartLine[];
  myParticipantId: string | null;
  isHost: boolean;
  amReady: boolean;
  /** Active (not-left) participants. */
  activeParticipants: SessionParticipant[];
  allReady: boolean;
  /** True on a scanned table (group ordering is offered). */
  available: boolean;
  start: (nickname: string) => Promise<string | null>;
  join: (shareCode: string, nickname: string) => Promise<string | null>;
  leave: () => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  addLine: (line: { itemId: string; modifierIds: string[]; qty: number; note: string }) => Promise<void>;
  setLineQty: (lineId: string, qty: number) => Promise<void>;
  placeGroup: () => Promise<{ ok: boolean; code?: string; orderId?: string }>;
  placeSolo: () => Promise<{ ok: boolean; code?: string; orderId?: string }>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { restaurant, table } = useVenue();
  const qrToken = table?.qr_token ?? null;
  const storageKey = qrToken ? `chehia.session.${qrToken}` : null;

  const [session, setSession] = useState<SessionState | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [lines, setLines] = useState<SessionCartLine[]>([]);
  const [myUid, setMyUid] = useState<string | null>(null);
  const placeRefRef = useRef<string | null>(null);

  const supabase = getSupabase();

  const refetch = useCallback(
    async (sessionId: string) => {
      const [{ data: parts }, { data: cartLines }, { data: srow }] = await Promise.all([
        supabase.from("session_participants").select("*").eq("session_id", sessionId).order("joined_at"),
        supabase.from("session_cart_lines").select("*").eq("session_id", sessionId).order("created_at"),
        supabase.from("order_sessions").select("id, share_code, status").eq("id", sessionId).maybeSingle(),
      ]);
      setParticipants((parts as SessionParticipant[] | null) ?? []);
      setLines((cartLines as SessionCartLine[] | null) ?? []);
      if (srow) setSession(srow as SessionState);
      // A session that closed elsewhere (placed/closed) drops us back to solo.
      if (srow && (srow as SessionState).status !== "open") {
        setSession(null);
        if (storageKey) storageRemove(storageKey);
      }
    },
    [supabase, storageKey],
  );

  // Restore a persisted session on mount (survives refresh / re-scan).
  useEffect(() => {
    if (!storageKey) return;
    const raw = storageGet(storageKey);
    if (!raw) return;
    let saved: { id?: string } = {};
    try {
      saved = JSON.parse(raw);
    } catch {
      storageRemove(storageKey);
      return;
    }
    if (!saved.id) return;
    void (async () => {
      const uid = await ensureCustomerSession().catch(() => null);
      setMyUid(uid);
      // Only restore if the session is still open and I'm still a member.
      const { data: srow } = await supabase.from("order_sessions").select("id, share_code, status").eq("id", saved.id!).maybeSingle();
      if (!srow || (srow as SessionState).status !== "open") {
        storageRemove(storageKey);
        return;
      }
      setSession(srow as SessionState);
      await refetch(saved.id!);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Realtime: any change to this session's participants or cart lines → refetch.
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`session-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_participants", filter: `session_id=eq.${session.id}` }, () => void refetch(session.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "session_cart_lines", filter: `session_id=eq.${session.id}` }, () => void refetch(session.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "order_sessions", filter: `id=eq.${session.id}` }, () => void refetch(session.id))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, supabase, refetch]);

  const persist = useCallback(
    (s: SessionState | null) => {
      if (!storageKey) return;
      if (s) storageSet(storageKey, JSON.stringify({ id: s.id }));
      else storageRemove(storageKey);
    },
    [storageKey],
  );

  const start = useCallback(
    async (nickname: string): Promise<string | null> => {
      const uid = await ensureCustomerSession();
      setMyUid(uid);
      const { data, error } = await supabase.rpc("start_session", { p_qr_token: qrToken, p_nickname: nickname });
      if (error || !data) return error?.message ?? "error";
      const s = { id: data.session_id as string, share_code: data.share_code as string, status: data.status as string };
      setSession(s);
      persist(s);
      await refetch(s.id);
      return null;
    },
    [supabase, qrToken, persist, refetch],
  );

  const join = useCallback(
    async (shareCode: string, nickname: string): Promise<string | null> => {
      const uid = await ensureCustomerSession();
      setMyUid(uid);
      const { data, error } = await supabase.rpc("join_session", { p_share_code: shareCode, p_nickname: nickname });
      if (error || !data) return error?.message ?? "error";
      const s = { id: data.session_id as string, share_code: data.share_code as string, status: data.status as string };
      setSession(s);
      persist(s);
      await refetch(s.id);
      return null;
    },
    [supabase, persist, refetch],
  );

  const myParticipant = useMemo(
    () => participants.find((p) => p.auth_uid === myUid && !p.left_at) ?? null,
    [participants, myUid],
  );
  const myParticipantId = myParticipant?.id ?? null;

  const leave = useCallback(async () => {
    if (!session) return;
    await supabase.rpc("leave_session", { p_session: session.id });
    setSession(null);
    persist(null);
    setParticipants([]);
    setLines([]);
  }, [supabase, session, persist]);

  const setReady = useCallback(
    async (ready: boolean) => {
      if (!session) return;
      await supabase.rpc("set_session_ready", { p_session: session.id, p_ready: ready });
      await refetch(session.id);
    },
    [supabase, session, refetch],
  );

  const addLine = useCallback(
    async (line: { itemId: string; modifierIds: string[]; qty: number; note: string }) => {
      if (!session || !myParticipantId) return;
      await supabase.from("session_cart_lines").insert({
        session_id: session.id,
        participant_id: myParticipantId,
        item_id: line.itemId,
        qty: line.qty,
        modifier_ids: line.modifierIds,
        note: line.note,
      });
      await refetch(session.id);
    },
    [supabase, session, myParticipantId, refetch],
  );

  const setLineQty = useCallback(
    async (lineId: string, qty: number) => {
      if (!session) return;
      if (qty <= 0) await supabase.from("session_cart_lines").delete().eq("id", lineId);
      else await supabase.from("session_cart_lines").update({ qty: Math.min(qty, 20) }).eq("id", lineId);
      await refetch(session.id);
    },
    [supabase, session, refetch],
  );

  const place = useCallback(
    async (mode: "group" | "solo"): Promise<{ ok: boolean; code?: string; orderId?: string }> => {
      if (!session) return { ok: false, code: "no_session" };
      await ensureCustomerSession();
      placeRefRef.current ??= crypto.randomUUID();
      const { ok, data } = await callFunction<{ order?: { id: string }; error?: { code?: string } }>("place-order", {
        session_id: session.id,
        place_mode: mode,
        client_ref: placeRefRef.current,
      });
      if (!ok || !data?.order) return { ok: false, code: data?.error?.code };
      placeRefRef.current = null;
      const orderId = data.order.id;
      if (mode === "group") {
        setSession(null);
        persist(null);
      } else {
        // Solo: I've left; drop back to solo browsing.
        setSession(null);
        persist(null);
      }
      return { ok: true, orderId };
    },
    [session, persist],
  );

  const activeParticipants = useMemo(() => participants.filter((p) => !p.left_at), [participants]);
  const allReady = activeParticipants.length > 0 && activeParticipants.every((p) => p.is_ready);

  const value: SessionContextValue = {
    session,
    participants,
    lines,
    myParticipantId,
    isHost: myParticipant?.is_host ?? false,
    amReady: myParticipant?.is_ready ?? false,
    activeParticipants,
    allReady,
    available: Boolean(qrToken),
    start,
    join,
    leave,
    setReady,
    addLine,
    setLineQty,
    placeGroup: () => place("group"),
    placeSolo: () => place("solo"),
  };

  // Keep the restaurant reference used (avoids an unused-var lint if trimmed later).
  void restaurant;

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
