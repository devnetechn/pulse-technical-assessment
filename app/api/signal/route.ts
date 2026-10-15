import type { NextRequest } from "next/server";
import { claimConnection, isConnectedPair, releaseConnection, transitionConnection } from "@/lib/connections";
import { prisma } from "@/lib/prisma";
import { readBoundedJson } from "@/lib/request";
import { authorizeSession, isSessionId } from "@/lib/session-auth";
import type { SignalType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: SignalType[] = [
  "request",
  "accept",
  "decline",
  "offer",
  "answer",
  "ice",
  "end",
];
const MAX_PAYLOAD = 64 * 1024;
const MAX_INBOX_SIZE = 100;
function isValidPayload(type: SignalType, payload: unknown): payload is string | null | undefined {
  if (type === "offer" || type === "answer" || type === "ice") {
    if (typeof payload !== "string" || payload.length === 0 || payload.length > MAX_PAYLOAD) {
      return false;
    }

    try {
      const value = JSON.parse(payload);
      if (value === null || typeof value !== "object") return false;
      if (type === "ice") return typeof value.candidate === "string";
      return value.type === type && typeof value.sdp === "string";
    } catch {
      return false;
    }
  }

  return payload === undefined || payload === null;
}

async function sendDecline(fromId: string, toId: string) {
  await prisma.signal.create({
    data: { fromId, toId, type: "decline" },
  });
}

export async function POST(request: NextRequest) {
  const body = await readBoundedJson(request, MAX_PAYLOAD + 8 * 1024);
  if (!body.ok) {
    return Response.json({ error: body.error }, { status: body.status });
  }

  const { fromId, toId, token, type, payload } = (body.value ?? {}) as Record<
    string,
    unknown
  >;
  if (
    !isSessionId(fromId) ||
    !isSessionId(toId) ||
    fromId === toId
  ) {
    return Response.json({ error: "invalid session ids" }, { status: 400 });
  }
  if (typeof type !== "string" || !VALID_TYPES.includes(type as SignalType)) {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }
  const signalType = type as SignalType;
  if (!isValidPayload(signalType, payload)) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }
  if (!(await authorizeSession(fromId, token))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const payloadStr = typeof payload === "string" ? payload : null;

  if (signalType === "request") {
    const cutoff = new Date(Date.now() - 15_000);
    const target = await prisma.presence.findUnique({
      where: { id: toId },
      select: { busy: true, connectionState: true, lastSeen: true },
    });
    if (
      !target ||
      target.lastSeen < cutoff ||
      target.busy ||
      target.connectionState !== "idle" ||
      !(await claimConnection(fromId, toId))
    ) {
      await sendDecline(toId, fromId);
      return Response.json({ ok: true, autoDeclined: true });
    }

    try {
      await prisma.signal.create({
        data: { fromId, toId, type: signalType },
      });
    } catch (error) {
      await releaseConnection(fromId, toId);
      throw error;
    }
    return Response.json({ ok: true });
  }

  if (signalType === "accept") {
    const accepted = await transitionConnection({
      fromId,
      toId,
      fromState: "incoming",
      toState: "outgoing",
      nextState: "connected",
    });
    if (!accepted) {
      return Response.json({ error: "connection request is no longer active" }, { status: 409 });
    }
  } else if (signalType === "decline") {
    const declined = await transitionConnection({
      fromId,
      toId,
      fromState: "incoming",
      toState: "outgoing",
      nextState: "idle",
    });
    if (!declined) {
      return Response.json({ error: "connection request is no longer active" }, { status: 409 });
    }
  } else if (signalType === "end") {
    if (!(await releaseConnection(fromId, toId))) {
      return Response.json({ ok: true });
    }
  } else if (!(await isConnectedPair(fromId, toId))) {
    return Response.json({ error: "no active connection" }, { status: 409 });
  }

  if (
    (signalType === "offer" ||
      signalType === "answer" ||
      signalType === "ice") &&
    (await prisma.signal.count({ where: { toId } })) >= MAX_INBOX_SIZE
  ) {
    return Response.json({ error: "recipient inbox is full" }, { status: 429 });
  }

  await prisma.signal.create({
    data: { fromId, toId, type: signalType, payload: payloadStr },
  });
  return Response.json({ ok: true });
}
