# E2E activation prepare — read-only architecture delta

21.10.2026. Reviewed only `apps/api/src/auth/flow-lifecycle.service.ts`, `link-flow.controller.ts` and the relevant PostgreSQL cases. No edits, builds, DB/SSH, production14 actions or new agents.

## Finding

**[P2] Preserve the non-expired COMPLETING capability during prepare.**

`apps/api/src/auth/flow-lifecycle.service.ts:41` rotates credentials for every status other than OPEN. This includes COMPLETING, which is an active durable operation, not a terminal flow. Calling prepare while consent/profile/completion receipts are pending replaces the browser's shared HttpOnly continuation cookies with a fresh unbound capability. The old operation may still finish in workers, while its browser can no longer recover the same operation using its cookie. A following fresh activation also escapes the active-flow conflict that was preserved for OPEN.

The intended rotation is appropriate for COMPLETED/CANCELLED/EXPIRED or an elapsed expiresAt. Non-expired OPEN and COMPLETING should retain their existing credentials. Add a focused case: begin a completion, hold its downstream processing at PENDING, call prepare with that cookie, verify unchanged cookie and recover the same operation; another activation must remain blocked until the prior flow terminates.

The added cases cover terminal completed/cancelled rows and the existing lost-exchange OPEN replay. They do not cover COMPLETING.

## Boundaries preserved in the remaining delta

- prepare remains Auth-owned lifecycle logic; controller delegates and emits the same `{status:"READY"}` DTO and limited cookies.
- It does not issue an access token, verify/consume an activation token, change User/orders, install a password or grant permission.
- Existing browser binding is checked before either preserving or rotating; forged pairing is rejected.
- A cookie with no persisted pending row is retained for the preparatory lost-response handshake; OPEN exchange replay keeps the same capability.
- No frontend HOC/public API/DTO contract changed. Terminal credential rotation itself creates no proof/session bypass.

136 native tests and API types/test-types/lint/build PASS were reported by root; this source-only review did not execute them. The P2 finding requires source/test follow-up; no production work is implied.

## Follow-up — P2 cleared by source correction

Root changed prepare to preserve a bound `COMPLETING` row regardless of the interactive expiresAt, preserve non-expired OPEN and rotate terminal/expired OPEN rows. The original P2 is **cleared at source level**: prepare no longer replaces the recovery capability of an unknown durable completion. Preserving the cookie does not extend the underlying flow's authority; existing completion/identity/session/TTL validation remains responsible for accepting or rejecting the operation.

The added native case explicitly submits an operation to PENDING/COMPLETING, calls prepare and asserts the unchanged cookie, attempts another guest activation without claiming its link, then recovers the original completion to COMPLETED. The terminal completed/cancelled rotation and OPEN lost-exchange replay cases remain present. Controller READY DTO and limited cookie ownership are unchanged.

No additional source flaws found in this narrow follow-up. No source edits/builds/tests/DB/SSH were performed by this reviewer. Root reported types/lint/build in progress and planned137 native cases; their eventual runtime result must be recorded separately and is not asserted here. Production14 remains outside this E2E correction.
