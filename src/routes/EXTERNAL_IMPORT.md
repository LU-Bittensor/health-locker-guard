# Epic import frontend handoff

`/external-import` is an explicitly labeled, memory-only UI preview. It makes no Epic requests and writes no records. A signed-out visitor can sign in to Medilink (returning via the allowlisted `/signin?returnTo=/external-import` path) or use a sample account. Reloading resets the simulation.

Preview paths:
- Connect → simulate approval → connected → import sample records → progress → results.
- Connect → cancel / dismiss dialog → cancelled → reconnect.
- Connect → simulate connection error → retry.
- Connected → select interrupted-import preview → import → error → retry successfully.
- During import → cancel → connected. Navigate away to stop preview timers.

Backend integration still needs an agreed API contract. Suggested operations (not existing endpoints):
- Start connection: authenticated request creates OAuth state/PKCE and returns an authorization URL; frontend navigates there.
- Callback: backend validates OAuth state, binds the result to the initiating Medilink account, exchanges the code, and redirects to `/external-import` without tokens in the URL.
- Connection status: authenticated response identifies connection status, selected sandbox patient, and available data categories.
- Start import: authenticated request returns a job ID.
- Import status: returns progress, per-category counts, warnings, and retryable errors. Define cancellation semantics before enabling a real cancel action.

Replace the route's simulated transitions/timers and `src/lib/external-import.ts` sample results with these responses. Remove the sample-account bypass and simulation controls from the live flow. Query parameters must never be treated as proof of a successful connection. Keep Epic credentials/tokens out of this UI. The backend must check account ownership of every connection and job.
