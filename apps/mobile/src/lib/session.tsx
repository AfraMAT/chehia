import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ensureCustomerSession, functionsUrl, supabase, supabaseAnonKey } from "./supabase";
import { useVenueState } from "./venue";

/**
 * Group ordering (Epic 2) — opt-in shared table session. Mirrors the web
 * `session-provider`: each guest at a scanned table can start/join a shared
 * session, add per-person attributed cart lines, and either the host places one
 * combined order/receipt when everyone is ready, or any guest splits off solo.
 * Cart-line writes go through direct table RLS; participants/lines sync live via
 * postgres_changes + refetch (the same pattern the app uses for orders).
 */
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

export interface PlaceSessionResult {
  ok: boolean;
  code?: string;
  orderId?: string;
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
  placeGroup: () => Promise<PlaceSessionResult>;
  placeSolo: () => Promise<PlaceSessionResult>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** RFC4122 v4 (Math.random based — used only as an idempotency key). */
function randomUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type StartRpc = { session_id: string; share_code: string; status: string } | null;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { state } = useVenueState();
  const table = state.status === "ready" ? state.bundle.table : null;
  const qrToken = table?.qr_token ?? null;
  const storageKey = qrToken ? `chehia.session.${qrToken}` : null;

  const [session, setSession] = useState<SessionState | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [lines, setLines] = useState<SessionCartLine[]>([]);
  const [myUid, setMyUid] = useState<string | null>(null);
  const placeRefRef = useRef<string | null>(null);

  const refetch = useCallback(
    async (sessionId: string) => {
      const [{ data: parts }, { data: cartLines }, { data: srow }] = await Promise.all([
        supabase.from("session_participants").select("*").eq("session_id", sessionId).order("joined_at"),
        supabase.from("session_cart_lines").select("*").eq("session_id", sessionId).order("created_at"),
        supabase.from("order_sessions").select("id, share_code, status").eq("id", sessionId).maybeSingle(),
      ]);
      setParticipants((parts as SessionParticipant[] | null) ?? []);
      setLines((cartLines as SessionCartLine[] | null) ?? []);
      const row = srow as SessionState | null;
      if (row) setSession(row);
      // A session that closed elsewhere (placed/closed) drops us back to solo.
      if (row && row.status !== "open") {
        setSession(null);
        if (storageKey) await AsyncStorage.removeItem(storageKey);
      }
    },
    [storageKey],
  );

  // Restore a persisted session on mount (survives backgrounding / re-scan).
  useEffect(() => {
    if (!storageKey) return;
    let cancelled = false;
    void (async () => {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw || cancelled) return;
      let saved: { id?: string } = {};
      try {
        saved = JSON.parse(raw);
      } catch {
        await AsyncStorage.removeItem(storageKey);
        return;
      }
      if (!saved.id) return;
      const uid = await ensureCustomerSession().catch(() => null);
      if (cancelled) return;
      setMyUid(uid);
      // Only restore if the session is still open and I'm still a member.
      const { data: srow } = await supabase.from("order_sessions").select("id, share_code, status").eq("id", saved.id).maybeSingle();
      const row = srow as SessionState | null;
      if (!row || row.status !== "open") {
        await AsyncStorage.removeItem(storageKey);
        return;
      }
      if (cancelled) return;
      setSession(row);
      await refetch(saved.id);
    })();
    return () => {
      cancelled = true;
    };
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
      void supabase.removeChannel(channel);
    };
  }, [session, refetch]);

  const persist = useCallback(
    (s: SessionState | null) => {
      if (!storageKey) return;
      if (s) void AsyncStorage.setItem(storageKey, JSON.stringify({ id: s.id }));
      else void AsyncStorage.removeItem(storageKey);
    },
    [storageKey],
  );

  const start = useCallback(
    async (nickname: string): Promise<string | null> => {
      const uid = await ensureCustomerSession();
      setMyUid(uid);
      const { data, error } = await supabase.rpc("start_session", { p_qr_token: qrToken, p_nickname: nickname });
      const d = data as StartRpc;
      if (error || !d) return error?.message ?? "error";
      const s: SessionState = { id: d.session_id, share_code: d.share_code, status: d.status };
      setSession(s);
      persist(s);
      await refetch(s.id);
      return null;
    },
    [qrToken, persist, refetch],
  );

  const join = useCallback(
    async (shareCode: string, nickname: string): Promise<string | null> => {
      const uid = await ensureCustomerSession();
      setMyUid(uid);
      const { data, error } = await supabase.rpc("join_session", { p_share_code: shareCode, p_nickname: nickname });
      const d = data as StartRpc;
      if (error || !d) return error?.message ?? "error";
      const s: SessionState = { id: d.session_id, share_code: d.share_code, status: d.status };
      setSession(s);
      persist(s);
      await refetch(s.id);
      return null;
    },
    [persist, refetch],
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
  }, [session, persist]);

  const setReady = useCallback(
    async (ready: boolean) => {
      if (!session) return;
      await supabase.rpc("set_session_ready", { p_session: session.id, p_ready: ready });
      await refetch(session.id);
    },
    [session, refetch],
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
    [session, myParticipantId, refetch],
  );

  const setLineQty = useCallback(
    async (lineId: string, qty: number) => {
      if (!session) return;
      if (qty <= 0) await supabase.from("session_cart_lines").delete().eq("id", lineId);
      else await supabase.from("session_cart_lines").update({ qty: Math.min(qty, 20) }).eq("id", lineId);
      await refetch(session.id);
    },
    [session, refetch],
  );

  const place = useCallback(
    async (mode: "group" | "solo"): Promise<PlaceSessionResult> => {
      if (!session) return { ok: false, code: "no_session" };
      await ensureCustomerSession();
      // Idempotency key survives a retry so a committed-but-lost response can't
      // duplicate the order.
      placeRefRef.current ??= randomUUID();
      const { data: sessionData } = await supabase.auth.getSession();
      type PlaceResponse = { order?: { id: string }; error?: { code?: string } };
      let json: PlaceResponse | null;
      try {
        const response = await fetch(functionsUrl("place-order"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({ session_id: session.id, place_mode: mode, client_ref: placeRefRef.current }),
        });
        json = (await response.json().catch(() => null)) as PlaceResponse | null;
        if (!response.ok || !json?.order) return { ok: false, code: json?.error?.code };
      } catch {
        return { ok: false, code: "network" };
      }
      placeRefRef.current = null;
      const orderId = json.order.id;
      // Group placement closes the session; a solo split leaves the group. Either
      // way we drop back to solo browsing on this device.
      setSession(null);
      persist(null);
      return { ok: true, orderId };
    },
    [session, persist],
  );

  const activeParticipants = useMemo(() => participants.filter((p) => !p.left_at), [participants]);
  const allReady = activeParticipants.length > 0 && activeParticipants.every((p) => p.is_ready);

  const value = useMemo<SessionContextValue>(
    () => ({
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
    }),
    [session, participants, lines, myParticipantId, myParticipant, activeParticipants, allReady, qrToken, start, join, leave, setReady, addLine, setLineQty, place],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
