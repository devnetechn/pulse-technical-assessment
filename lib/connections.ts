import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PairTransition = {
  fromId: string;
  toId: string;
  fromState: string;
  toState: string;
  nextState: string;
};

async function countTransition(
  query: ReturnType<typeof buildTransitionQuery>,
): Promise<number> {
  const result = await prisma.$queryRaw<{ count: number }[]>(query);
  return result[0]?.count ?? 0;
}

function buildTransitionQuery({
  fromId,
  toId,
  fromState,
  toState,
  nextState,
}: PairTransition) {
  return Prisma.sql`
    WITH eligible AS MATERIALIZED (
      SELECT "id"
      FROM "Presence"
      WHERE (
        "id" = ${fromId}
        AND "peerId" = ${toId}
        AND "connectionState" = ${fromState}
      ) OR (
        "id" = ${toId}
        AND "peerId" = ${fromId}
        AND "connectionState" = ${toState}
      )
      ORDER BY "id"
      FOR UPDATE
    ),
    updated AS (
      UPDATE "Presence" AS presence
      SET
        "busy" = ${nextState !== "idle"},
        "connectionState" = ${nextState},
        "peerId" = CASE WHEN ${nextState === "idle"} THEN NULL ELSE presence."peerId" END
      WHERE presence."id" IN (SELECT "id" FROM eligible)
        AND (SELECT COUNT(*) FROM eligible) = 2
      RETURNING presence."id"
    )
    SELECT COUNT(*)::int AS "count" FROM updated
  `;
}

export async function claimConnection(
  fromId: string,
  toId: string,
): Promise<boolean> {
  const result = await prisma.$queryRaw<{ count: number }[]>`
    WITH eligible AS MATERIALIZED (
      SELECT "id"
      FROM "Presence"
      WHERE "id" IN (${fromId}, ${toId})
        AND "connectionState" = 'idle'
      ORDER BY "id"
      FOR UPDATE
    ),
    updated AS (
      UPDATE "Presence" AS presence
      SET
        "busy" = TRUE,
        "peerId" = CASE WHEN presence."id" = ${fromId} THEN ${toId} ELSE ${fromId} END,
        "connectionState" = CASE WHEN presence."id" = ${fromId} THEN 'outgoing' ELSE 'incoming' END
      WHERE presence."id" IN (SELECT "id" FROM eligible)
        AND (SELECT COUNT(*) FROM eligible) = 2
      RETURNING presence."id"
    )
    SELECT COUNT(*)::int AS "count" FROM updated
  `;
  return result[0]?.count === 2;
}

export async function transitionConnection({
  fromId,
  toId,
  fromState,
  toState,
  nextState,
}: PairTransition): Promise<boolean> {
  return (await countTransition(
    buildTransitionQuery({ fromId, toId, fromState, toState, nextState }),
  )) === 2;
}

export async function releaseConnection(
  fromId: string,
  toId: string,
): Promise<boolean> {
  const result = await prisma.$queryRaw<{ count: number }[]>`
    WITH eligible AS MATERIALIZED (
      SELECT "id"
      FROM "Presence"
      WHERE (
        "id" = ${fromId}
        AND "peerId" = ${toId}
        AND "connectionState" <> 'idle'
      ) OR (
        "id" = ${toId}
        AND "peerId" = ${fromId}
        AND "connectionState" <> 'idle'
      )
      ORDER BY "id"
      FOR UPDATE
    ),
    updated AS (
      UPDATE "Presence" AS presence
      SET "busy" = FALSE, "peerId" = NULL, "connectionState" = 'idle'
      WHERE presence."id" IN (SELECT "id" FROM eligible)
        AND (SELECT COUNT(*) FROM eligible) = 2
      RETURNING presence."id"
    )
    SELECT COUNT(*)::int AS "count" FROM updated
  `;
  return result[0]?.count === 2;
}

export async function isConnectedPair(
  fromId: string,
  toId: string,
): Promise<boolean> {
  const result = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS "count"
    FROM "Presence"
    WHERE (
      "id" = ${fromId}
      AND "peerId" = ${toId}
      AND "connectionState" = 'connected'
    ) OR (
      "id" = ${toId}
      AND "peerId" = ${fromId}
      AND "connectionState" = 'connected'
    )
  `;
  return result[0]?.count === 2;
}
