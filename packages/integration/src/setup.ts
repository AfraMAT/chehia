// Node 20 has no global WebSocket; supabase-js realtime expects one.
import WebSocket from "ws";

if (!(globalThis as Record<string, unknown>).WebSocket) {
  (globalThis as Record<string, unknown>).WebSocket = WebSocket;
}
