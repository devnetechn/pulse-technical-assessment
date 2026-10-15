// Client-side helpers for talking to the coordination API.
import type { PollResponse, SignalType } from "@/lib/types";

export interface Session {
  id: string;
  token: string;
}

export async function join(
  lat: number,
  lng: number,
): Promise<Session> {
  const response = await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  });
  if (!response.ok) throw new Error(`join failed: ${response.status}`);
  return response.json();
}

export async function poll(id: string, token: string): Promise<PollResponse> {
  const res = await fetch(`/api/poll?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

export async function sendSignal(
  fromId: string,
  token: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<void> {
  const response = await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromId, token, toId, type, payload }),
  });
  if (!response.ok) throw new Error(`signal failed: ${response.status}`);
}

// Fire-and-forget leave that survives the tab closing.
export function leave(id: string, token: string): void {
  const body = JSON.stringify({ id, token });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/leave", body);
  } else {
    void fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }
}
