import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeSession } from "@/lib/session-auth";
import { readBoundedJson } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { id, token }. Removes the presence row and any pending
// signals to/from this user. Called via navigator.sendBeacon on tab close, so
// the body may arrive as text — parse defensively.
export async function POST(request: NextRequest) {
  const body = await readBoundedJson(request, 1024);
  if (!body.ok) {
    return Response.json({ error: body.error }, { status: body.status });
  }

  const { id, token } = (body.value ?? {}) as Record<string, unknown>;
  if (typeof id !== "string" || typeof token !== "string") {
    return Response.json({ error: "invalid session" }, { status: 400 });
  }
  if (!(await authorizeSession(id, token))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const session = await prisma.presence.findUnique({
    where: { id },
    select: { peerId: true },
  });
  await prisma.presence.deleteMany({ where: { id } });
  await prisma.signal.deleteMany({
    where: { OR: [{ toId: id }, { fromId: id }] },
  });

  if (session?.peerId) {
    const released = await prisma.presence.updateMany({
      where: { id: session.peerId, peerId: id },
      data: { busy: false, peerId: null, connectionState: "idle" },
    });
    if (released.count > 0) {
      await prisma.signal.create({
        data: {
          fromId: id,
          toId: session.peerId,
          type: "end",
        },
      });
    }
  }

  return Response.json({ ok: true });
}
