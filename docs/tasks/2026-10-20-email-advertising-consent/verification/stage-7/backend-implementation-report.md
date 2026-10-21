# Stage 7 backend result — 21.10.2026

Implemented in the existing task worktree. No commit, deploy, production DB, SSH, external SMTP or real Yandex request.

## Delivered

- `YandexOAuthService` now only exchanges authorization code + PKCE verifier and fetches the authenticated provider profile. It never creates/updates Users, links an AuthAccount or issues JWT. Fixed provider endpoints, 10-second per-request timeout, redirects rejected, profile client_id checked when supplied, email validated/normalized.
- `YandexFlowService` owns the short-lived attempt, hash-only persistence, one-time exchange claim, same-input retry/result, cancellation, email-policy publication and the limited pending continuation.
- `POST /auth/flow/yandex/start`: `{attemptId, authorizationUrl}`; writes pending/browser + state/PKCE HttpOnly cookies.
- `POST /auth/flow/yandex/callback`: `{code?,state,error?}`; no JWT. Returns `{attemptId,status:WAITING|PENDING|REJECTED,state?|errorCode?}`. Same callback/capability/browser/input returns persisted outcome; changing code/state/cookies fails. OAuth state/PKCE cookies clear after an accepted result; retry may use the same server-bound input without those cleared cookies.
- `GET /auth/flow/yandex/result?attemptId=...`: same safe result, pending/browser-bound. A public attemptId alone authorizes nothing.
- Existing API callback becomes a fixed no-store/no-referrer relay to `/auth/oauth/yandex/callback` on SITE_URL; it forwards only bounded code/state/error, no arbitrary next/error_description, no session cookie.
- State+S256 PKCE, browser and pending capability binding, ten-minute TTL, exchange CAS, cancellation before/after exchange, outcome reread and late-result suppression.
- Existing linked provider + exact Users verification uses its original RecordedEmailProof/date. New/unverified exact default_email uses YANDEX_VERIFIED_EMAIL under the user's explicitly accepted provider-email trust policy. No fake email_verified claim or invented OTP is recorded. Missing/unsuitable email remains a safe rejection, not an extra OTP flow.
- New Yandex registration has no local password. Existing email can retain its User/profile/password/guest orders. New AuthAccount creation/linking waits until common Users/Consents receipts and final Auth completion transaction. Provider subject/user collisions reject without reassignment. Auth state and completion revalidate the immutable providerUserIdSnapshot.
- Common FlowLifecycle cancellation covers OAuth attempts in flight; cleanup expires attempts. Existing principal/account status/version checks and CompletionSessionCheck remain in force.
- Old direct OAuth upsert/JWT endpoints and replaced provider APIs/constants/test branches removed. Providers listing retained.

## Schema

New migration `20261021090000_yandex_continuation` adds OAuthState capability/browser hashes, PKCE challenge, callback input hash, persisted outcome/flow snapshot, cancellation time; AuthAuthenticationFact gets immutable providerUserIdSnapshot. Proof-binding trigger now distinguishes historical Users email confirmation from the accepted Yandex provider-email policy. No raw verifier/code/token in DB; no Users/credential/consent backfill. Migration applied only in isolated test schemas.

## Architecture

Provider transport -> Auth-owned attempt/identity/flow -> persisted domain commands -> Users/Consents receipts -> Auth-owned final account binding -> existing late completion session issuance. No frontend/FSD concepts introduced to Nest. Backend never writes foreign Users/profile/consent business state.

## Validation

- 114/114 native PostgreSQL + HTTP (95 existing + 19 new OAuth scenarios), full migration history.
- Latest cleanup targeted API regressions:174/174, including 5 authenticated provider transport tests, real404cutoverHTTP and current recovery DTO contract. Earlier pre-cleanup176/176 included8now-removed legacy bypass tests; not a claim that the unrelated full API suite passes.
- API check-types, test-types, lint, build and Prisma validate passed. Final changed versioning/provider transport repeat: 29/29. Logs alongside this report.
- Meaningful coverage: linked/new/missing profile/current consents/no password/no OTP, original confirmation date, existing password/user retention, guest orders, provider collision before and after proof, state/PKCE/foreign cookie/result binding/expiry, same callback replay, in-flight duplicate, denial/exchange failure, cancellation during exchange, switched session and safe relay.
- Test provider responses mocked in an isolated fixture; actual HTTP transport separately tested without external calls.
- Own PostgreSQL 62311 stopped after native tests; cleanup log includes final lsof check.

Official sources researched: https://yandex.ru/dev/id/doc/ru/user-information and https://yandex.ru/dev/id/doc/ru/codes/code-url. Provider API does not document email_verified; accepted default_email trust is a recorded product decision, not a newly asserted provider guarantee.
