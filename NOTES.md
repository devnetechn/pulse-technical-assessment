# Pulse assessment notes

## Phase 1 — Make it run

- Reproduced failures in the two-participant flow and traced them through polling, connection state, and WebRTC signaling. Fixed the global heartbeat bug so a poll only refreshes its authenticated user; stale sessions now expire and notify their active peer.
- Fixed the chat data-channel type mismatch and queued ICE handling so candidates are applied after the remote description is set.
- Added reliable connection claiming/release, request timeouts, leave cleanup, and clearer reconnect/error feedback.
- Corrected privacy-offset calculations with a great-circle calculation, preserving the 1–3 km distance at high latitudes and across the date line.
- Verified with TypeScript, ESLint, Prisma schema validation, a production build, and a deployed two-participant test. The database schema was pushed to Supabase.

## Phase 2 — Make it good

- Reworked the entry screen, live-map chrome, connection prompts, chat, and video UI into a cohesive dark, soft-green visual system. The responsive layout, motion, and reduced-motion support aim to make the experience polished without obscuring connection and privacy states.
- Added accessible labels, visible focus styles, clearer connection status, and a useful empty-map/no-token state.
- Fixed landing-page overflow below the footer by clipping decorative background glows to the page container; verified the footer sits at the document bottom on mobile and desktop.

## Phase 3 — Make it secure

- Highest priority: unauthenticated session spoofing and arbitrary signaling could impersonate users or interfere with calls. Sessions now use server-generated IDs and one-time random tokens; only token hashes are stored, and polling, leave, and signaling require authentication.
- Also addressed oversized or malformed requests and signaling to the wrong peer: request bodies are bounded, SDP/ICE payloads are validated and capped, and signaling is accepted only for the active peer pair.
- Reduced stale-presence and pairing race issues: connections are claimed atomically, request inboxes are capped, and polling no longer refreshes or exposes stale sessions.
- Upgraded Next.js and aligned Prisma packages. `npm audit --omit=dev` reports no production advisories. Five high findings remain in the ESLint development-tool dependency chain; the available audit fix downgrades `eslint-config-next` to an incompatible major, so it was not applied.

## Phase 4 — Make it better

- Added optional, rotating “Conversation sparks” to make starting a conversation feel easier and more alive. Prompts stay in the browser until chosen; they enter the composer for review and editing before sending.
- Kept the feature ephemeral and peer-to-peer, with no new profile or message storage. With more time, I would add user-controlled block/report tools and evaluate TURN for users on restrictive networks.
- Published the completed assessment to the public submission repository and deployed the app to Vercel.

## Assumptions and blockers

- Kept the assessment’s STUN-only WebRTC setup; strict networks may still require TURN.
- Tested the two-participant connect, accept, chat, and video flow; camera and microphone were confirmed working. Connectivity through restrictive networks was not verified.
- Vercel could not reach Supabase through the direct database host. Switched the deployment’s database connection to the Supabase transaction pooler; the deployed join flow then worked, and the schema is synchronized.
- The live app is available at https://pulse-technical-assessment-livid.vercel.app/. The public submission repository is https://github.com/devnetechn/pulse-technical-assessment.
