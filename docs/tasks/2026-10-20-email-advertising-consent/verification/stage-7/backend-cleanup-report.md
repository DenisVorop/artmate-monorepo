# Stage 7 route cutover cleanup

Full non-test consumer scan across apps/packages found no consumers of these old HTTP endpoints:

- POST /auth/order-activation/confirm
- POST /auth/order-activation/validate
- POST /auth/password-reset/confirm
- POST /auth/recovery/request

Removed the four AuthController handlers and their service injections; six request/response DTO files and exports; obsolete OrderActivationService.confirmActivation/validateActivation and credential-only dependency/private helper. Kept Orders guest attachment, reusable activation token queue/recovery/notification delivery, and PasswordResetService.confirmReset used by RecoveryFlowService. Login/register/email-verification remain for real consumers until stage 8.

Removed eight superseded service/controller tests, including early password/session issuance. Activation email worker test now proves the generated link's signature and token hash directly; existing new-flow native tests cover its actual exchange/completion. Telegram DTO tests use the current email-only recovery DTO and retain legacy registration consent checks while those consumers still exist.

Added real Nest HTTP cutover tests with isolated providers: AuthController is positively mounted, four old POST paths return404 with no session cookie/issuance, new shared recovery endpoint accepts email-only and returns its neutral response without session.

Latest targeted API run:174/174, including provider transport, migration/security/versioning, Orders/notification/recovery tests, cutover HTTP and Telegram DTO contract. Test types/lint passed; check-types/build logs alongside this note. Final after-cleanup native PostgreSQL+HTTP:114/114 passed on the existing isolated cluster and a new random schema, including the smaller service dependency list. Full migration history applied in the test schema; the cluster shut down normally and lsof confirms no listener on62311.

Changed/deleted exact paths are in changed-files.txt/deleted-files.txt. No commit/deploy/production DB/SSH/SMTP/external provider calls. Own test HTTP server closes via after(); PostgreSQL62311 stays stopped.
