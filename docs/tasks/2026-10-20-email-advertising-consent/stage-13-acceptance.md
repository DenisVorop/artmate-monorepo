# Этап 13 — карта общей приёмки

Текущий выполненный объём:1/1b/2/2b/3a/3b/4/5/6/7/8/9/12. 10/11 отложены пользователем. Здесь карта покрытия; свежие результаты/числа и ограничения в stage-13-report/verification/stage-13. Исторические PASS отдельно не суммируются.

| Требование | Backend / source | Frontend / browser |
| --- | --- | --- |
| Email+password без OTP; wrong password, existing hash | auth-flow.postgres, auth-versioning, credentials tests | auth-coordinator, auth-flow-forms, standalone password browser |
| Signup: code только proof, password+confirm, mismatch | auth-flow.postgres, auth-flow-security | forms/coordinator, signup/mismatch/Eye/resend browser |
| Guest purchase: тот же User/orders, activation без нового code | auth-flow.postgres, order-activation, auth-route-cutover | activation route/flow forms, existing-profile browser |
| Reset/recovery без ранней сессии/рекламы | auth-flow.postgres, password-reset, order-activation | recovery/reset route browser, sensitive mutations |
| Missing profile/PDn/optional ads, ready without redundant screen | auth-flow.postgres, consent command/receipt checks | coordinator/SESSION, PDnfalse/adsfalse/ready browser |
| Единый withAuth/useAuth: owner/cancel/late/unmount/cache | persisted auth operations и SiteActionGuard | auth-coordinator/session-publication/guarded-business-forms, caller browser |
| Contact/partner, promo/loyalty, guest checkout | business-form.module, partner-applications, native guards/provenance | guarded forms/guest checkout/promo tests и real route browser |
| Яндекс без local password/code, subject/linking/security | native provider cases и yandex-oauth.service | popup polling/callback/closed/blocked/privacy browser |
| Consent fact/version/source/requestContext и revoke/fencing | auth native, consents payload/evidence/token SQL tests | settings+unsubscribe tests/browser |
| Hash-only old link, GET read-only, strict human/RFC POST | native HTTP и unsubscribe migration/token tests | public route/duplicate/retry/history/cache browser |
| Backup/restore полного graph и старой отписки | native auth-backup.postgres +32infra shell checks | Не UI сценарий; runbook/env/Compose/source audit |
| Светлый UI, Eye/EyeOff, 3D assets, mobile/keyboard | FSD/source audit | actual production browser320/390/1280, focus/target/overflow/errors |
| Legal links/единый viewer/все PDF pages | source-documents/file/header/page routing audit |7 PDF mobile/desktop viewer; актуальность legal approval не выводится из renderer |
| Доменные владельцы, FSD, RHF/model/lib/public API, no bypass/demo | отдельный read-only architecture audit + source review root | route/page composition и shared transport границы |

Production/real SSO/SMTP/рабочая БД, legal J1/J2/J3, публикация registry, GitHub secrets/offsite settings не проверяются через local fixtures. Готовность сборки и приёмка тестового runtime не равны разрешению выпуска 14.
