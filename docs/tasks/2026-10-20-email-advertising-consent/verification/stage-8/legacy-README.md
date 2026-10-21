# Этап8: legacy cleanup и session publication

Изменения применены в task worktree `codex/email-advertising-consent`.

- Удалены старые AuthForm, hooks login/register/confirm/resend, мапперы/типы verification flow и auth-error, их exports, старые site server actions/DTO.
- Удалён неиспользуемый OAuth landing и routes.authOAuth. Реальный Яндекс callback и новые flow actions сохранены.
- `publish-auth-session.ts` подключён к AuthProvider. Перед публикацией свежей session отменяет старые session/private reads, удаляет achievement/loyalty/orders/workshop/feature-banners/welcome-offer caches. Данные корзины и введённый промокод сохраняются; pricing инвалидируется. Callback coordinator ждёт публикацию session.
- Обычный auth.actions теперь читает session/providers, обслуживает logout и Telegram; устанавливать JWT он больше не умеет. JWT остаётся полномочием завершённого нового flow.
- Signup tests используют настоящий coordinator+analytics adapter; goal появляется только после completion/session, а не после code/draft. Обновлён устаревший регистрационный абзац analytics/AGENTS.md.
- Consumer tests checkout/welcome/promocodes переведены с удалённых hooks/AuthForm на новый public contract.

Проверки:119 tests в8 targeted test files,0 failed (`targeted.log`). После lint alias для тестового вызова analytics adapter:7/7 cache+signup tests (`final-targeted.log`). Новые3 cache tests выполняют actual QueryClient и проверяют сохранность cart/promo, отмену позднего session response и cancellation barrier. Полный lint/types/build/site suite выполнял root agent.

Поиск legacy identifiers в `apps/site/src`, `app`, `test` не нашёл consumers. Checkout source, contact/partner implementation, shared analytics transport и backend не изменялись этой подзадачей. Коммитов, production/SMTP/DB действий нет.

Browser evidence этапа8: `/tmp/artmate-stage8-browser`.
