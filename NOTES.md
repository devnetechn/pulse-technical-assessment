# Pulse assessment notes

## Phase 1 — Make it run

- Fixed the global heartbeat bug so a poll only refreshes its authenticated user; stale sessions now expire and notify their active peer.
- Fixed the chat data-channel type mismatch and applied queued ICE candidates after the remote description is set.
- Added reliable connection claiming/release, request timeouts, leave cleanup, and clearer reconnect/error feedback.
- Privacy offsets now use a great-circle calculation, preserving the 1–3 km distance at high latitudes and across the date line.
- Verified with TypeScript, ESLint, Prisma schema validation, and a production build. The database schema was pushed to Supabase and the deployed app was tested with two participants.

## Phase 2 — Make it good

- Reworked the entry screen, live-map chrome, connection prompts, chat, and video UI into a cohesive dark, soft-green visual system with responsive layouts, motion, and reduced-motion support.
- Added accessible labels, visible focus styles, clearer connection status, and a useful empty-map/no-token state.
- Fixed landing-page overflow below the footer by clipping decorative background glows to the page container; verified the footer sits at the document bottom on mobile and desktop.

## Phase 3 — Make it secure

- Prioritized unauthenticated session spoofing and arbitrary signaling. Sessions now use server-generated IDs and one-time random tokens; only token hashes are stored.
- Polling, leave, and signaling are authenticated. Requests have bounded bodies and SDP/ICE payloads are validated and capped; signaling is accepted only for the active peer pair.
- Connection pairing is claimed atomically, request inboxes are capped, and the poll endpoint no longer refreshes or exposes stale sessions.
- Upgraded Next.js and aligned Prisma packages. `npm audit --omit=dev` reports no production advisories. Five high findings remain in the ESLint development-tool dependency chain; the available audit fix downgrades `eslint-config-next` to an incompatible major, so it was not applied.

## Phase 4 — Make it better

- Added optional, rotating “Conversation sparks” to help start a chat. Prompts stay in the browser until the user chooses one; using a prompt puts it in the composer for review and editing before sending.
- Kept the feature ephemeral and peer-to-peer, with no new profile or message storage.
- Published the completed assessment to the public submission repository and deployed the app to Vercel.

## Assumptions and blockers

- Kept the assessment’s STUN-only WebRTC setup; strict networks may still require TURN.
- Tested the two-participant connect, accept, chat, and video-request flow with synthetic media. Real camera/microphone devices and connectivity through restrictive networks were not verified.
- Supabase database schema is synchronized, and the live app is available at https://pulse-technical-assessment-livid.vercel.app/. The public submission repository is https://github.com/devnetechn/pulse-technical-assessment.
