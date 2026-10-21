# Stage9 harness notes

- Actual Next production build, actual React components and server actions. HTTP-only fake API on127.0.0.1:62332. No product test routes/adapters/panels added.
- External requests are intercepted before dispatch; synthetic access/pending cookies, token A×43/B×43, contact fixtures only. No real OAuth, SMTP, payment, SSH or working DB.
- Initial11 cases before fixes passed scenario behavior; browser found two product issues: Next persisted capability in history.state private tree/renderedSearch despite clean visible URL, and standalone legal link20px height. Root owns source fixes; strict rerun required.
- Initial cross-tab failure was harness lifecycle injection: document.dispatchEvent(non-bubbling visibilitychange) did not reach TanStack window listener. Corrected window event; real second-tab unsubscribe then visibility-triggered refetch passed.
- Initial account-switch harness deadlocked because awaiting invalidateQueries used serialized server actions behind held revoke. Probe now publishes a fresh fakeAPI session into actual QueryClient while changing synthetic HTTP-only actor cookie; this verifies the late-result owner guard, not cross-tab login wiring.
- Initial standalone router experiment was sandbox-blocked Chrome launch; no product result inferred. All browser launches use escalated QA execution thereafter.
- Target measurements cover only new feature controls; existing profile/Telegram/footer/header are outside this feature scope.
- Back/forward probe navigates away from cleaned document then back/forward; capability must stay absent and no automatic POST may occur.

- Final strict attempt13 scenario assertions passed, but global error assertion caught the QA cookie-consent initScript touching localStorage on opaque about:blank documents. Guarded initScript to HTTP(S) documents; errors were from harness, not product. Full strict rerun follows.
- Back/Forward initial attempt used same-URL goto (reload), so goBack reached about:blank. Corrected by creating a distinct safe navigation entry before cleanup.
