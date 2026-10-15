import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export interface SessionCredentials {
  id: string;
  token: string;
}

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export function createSessionCredentials(): SessionCredentials {
  return {
    id: randomUUID(),
    token: randomBytes(32).toString("base64url"),
  };
}

export function hashSessionToken(token: string): string {
  return hashToken(token).toString("hex");
}

export function isSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

export async function authorizeSession(
  id: string,
  token: unknown,
): Promise<boolean> {
  if (
    !isSessionId(id) ||
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    return false;
  }

  const session = await prisma.presence.findUnique({
    where: { id },
    select: { authTokenHash: true },
  });
  if (!session) return false;

  const expected = Buffer.from(session.authTokenHash, "hex");
  const actual = hashToken(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length);
}
