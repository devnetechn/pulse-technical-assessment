import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";
import { createSessionCredentials, hashSessionToken } from "@/lib/session-auth";
import { readBoundedJson } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/join — body { lat, lng } (raw coords).
// Applies a 1–3 km privacy offset and creates the presence row. Raw
// coordinates are never stored. A session token is returned once and only
// its hash is persisted.
export async function POST(request: NextRequest) {
  const body = await readBoundedJson(request, 1024);
  if (!body.ok) {
    return Response.json({ error: body.error }, { status: body.status });
  }

  const { lat, lng } = (body.value ?? {}) as Record<string, unknown>;
  if (!isValidLatLng(lat, lng)) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }

  const { id, token } = createSessionCredentials();
  const offset = applyPrivacyOffset(Number(lat), Number(lng));

  await prisma.presence.create({
    data: {
      id,
      authTokenHash: hashSessionToken(token),
      lat: offset.lat,
      lng: offset.lng,
      lastSeen: new Date(),
    },
  });

  return Response.json(
    { id, token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
