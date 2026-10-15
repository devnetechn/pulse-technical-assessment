# Pulse assessment notes

## Phase 1 — Make it run

- Fixed the global heartbeat bug so a poll only refreshes its authenticated user; stale sessions now expire and notify their active peer.
- Fixed the chat data-channel type mismatch and applied queued ICE candidates after the remote description is set.
- Added reliable connection claiming/release, request timeouts, leave cleanup, and clearer reconnect/error feedback.
- Privacy offsets now use a great-circle calculation, preserving the 1–3 km distance at high latitudes and across the date line.
- Verified with TypeScript, ESLint, Prisma schema validation, and a production build. A live two-user test still needs configured Postgres and Mapbox credentials.

## Phase 2 — Make it good

- Reworked the entry screen, live-map chrome, connection prompts, chat, and video UI into a cohesive dark, soft-green visual system with responsive layouts, motion, and reduced-motion support.
- Added accessible labels, visible focus styles, clearer connection status, and a useful empty-map/no-token state.

## Phase 3 — Make it secure

- Prioritized unauthenticated session spoofing and arbitrary signaling. Sessions now use server-generated IDs and one-time random tokens; only token hashes are stored.
- Polling, leave, and signaling are authenticated. Requests have bounded bodies and SDP/ICE payloads are validated and capped; signaling is accepted only for the active peer pair.
- Connection pairing is claimed atomically, request inboxes are capped, and the poll endpoint no longer refreshes or exposes stale sessions.
- Upgraded Next.js and aligned Prisma packages. `npm audit --omit=dev` reports no production advisories. Five high findings remain in the ESLint development-tool dependency chain; the available audit fix downgrades `eslint-config-next` to an incompatible major, so it was not applied.

## Phase 4 — Make it better

- Added optional, rotating “Conversation sparks” to help start a chat. Prompts stay in the browser until the user chooses one; using a prompt puts it in the composer for review and editing before sending.
- Kept the feature ephemeral and peer-to-peer, with no new profile or message storage.

## Assumptions and blockers

- Kept the assessment’s STUN-only WebRTC setup; strict networks may still require TURN.
- No working `DATABASE_URL`, Mapbox token, or Vercel project credentials were available here. The database push, live two-participant test, and Vercel deployment remain blocked on those credentials. The public submission repository was created separately from the assessment origin and pushed to `https://github.com/devnetechn/pulse-technical-assessment`.
