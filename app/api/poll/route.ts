import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_MS, SIGNAL_TTL_MS } from "@/lib/presence";
import type { PollResponse } from "@/lib/types";
import { authorizeSession, bearerToken } from "@/lib/session-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/poll?id= — the single endpoint that drives the live map.
// It (1) heartbeats the caller, (2) reaps stale presence + orphan signals,
// (3) returns the filtered online peers, and (4) drains this user's mailbox.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("id");

  if (!id) {
    return Response.json({ error: "missing id" }, { status: 400 });
  }
  if (!(await authorizeSession(id, bearerToken(request)))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const staleCutoff = new Date(now - STALE_MS);
  const signalCutoff = new Date(now - SIGNAL_TTL_MS);

  // Heartbeat only the authenticated caller, never every online session.
  const heartbeat = await prisma.presence.updateMany({
    where: { id },
    data: { lastSeen: new Date(now) },
  });
  if (heartbeat.count === 0) {
    return Response.json({ error: "session expired" }, { status: 401 });
  }

  // Reap stale sessions and notify any still-connected peer in one statement.
  await prisma.$queryRaw`
    WITH stale AS (
      DELETE FROM "Presence"
      WHERE "lastSeen" < ${staleCutoff}
        AND "id" <> ${id}
      RETURNING "id", "peerId"
    ),
    released AS (
      UPDATE "Presence" AS peer
      SET "busy" = FALSE, "peerId" = NULL, "connectionState" = 'idle'
      FROM stale
      WHERE peer."id" = stale."peerId"
        AND peer."peerId" = stale."id"
      RETURNING peer."id" AS "peerId", stale."id" AS "staleId"
    ),
    notified AS (
      INSERT INTO "Signal" ("toId", "fromId", "type", "payload")
      SELECT "peerId", "staleId", 'end', NULL
      FROM released
      RETURNING "id"
    )
    SELECT COUNT(*)::int FROM stale
  `;
  await prisma.signal.deleteMany({ where: { createdAt: { lt: signalCutoff } } });

  // 3) Online peers, excluding self.
  const peers = await prisma.presence.findMany({
    where: {
      id: { not: id },
      lastSeen: { gte: staleCutoff },
    },
    select: { id: true, lat: true, lng: true, busy: true },
  });

  // 4) Drain this user's mailbox: read, then delete exactly what we read so a
  // concurrently-inserted signal is never lost.
  const inbox = await prisma.signal.findMany({
    where: { toId: id },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  if (inbox.length > 0) {
    await prisma.signal.deleteMany({
      where: { id: { in: inbox.map((s) => s.id) } },
    });
  }

  const response: PollResponse = {
    peers: peers.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      busy: p.busy,
    })),
    signals: inbox.map((s) => ({
      id: s.id,
      fromId: s.fromId,
      toId: s.toId,
      type: s.type as PollResponse["signals"][number]["type"],
      payload: s.payload,
      createdAt: s.createdAt.toISOString(),
    })),
  };

  return Response.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
