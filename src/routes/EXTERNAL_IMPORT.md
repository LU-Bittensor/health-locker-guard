# Epic import frontend

`/external-import` uses a real MediLink Supabase session to start the Epic Sandbox OAuth flow. Demo mode is rejected. `/external-import/callback` submits the returned code/state (or denial) to the authenticated backend and displays its verified result. Tokens remain on the backend; the callback clears its query string from browser history.

The imports page loads the account-bound saved status on entry, focus, and every 30 seconds. Token exchange success and transfer authorization readiness are separate states. Data transfer is disabled until EHR intake is implemented; there are no sample record counts or simulated imports.

See [backend OAuth setup](../../../backend/EPIC_OAUTH.md) for registration, endpoints and testing. Use the same frontend hostname as the configured callback to preserve the Supabase session. The callback route filename uses TanStack's non-nested suffix so it renders independently of the imports page.
