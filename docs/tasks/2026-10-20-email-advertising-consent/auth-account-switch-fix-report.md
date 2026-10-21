# Исправление смены аккаунта — 21.10.2026

По прямому поручению пользователя исправлен баг из auth-retest-report.md: незавершённый входA после reload и вводаB больше не возобновляется вместоB.

## Изменение

Только `features/auth/lib/auth-flow-coordinator.ts` и `test/auth-coordinator.test.mjs`. Перед явным входом по паролю coordinator отменяет прежнюю restricted continuation через существующий cancel port, затем отправляет введённые credentials. Отсутствие pending flow (401на отмене) не мешает обычному входу. При иной ошибке отмены credentials не отправляются. Если owner закрыл/размонтировал форму в ожидании отмены, последующий login не выполняется.

Ошибки password-входа теперь остаются на его форме с коротким текстом. Они не запускают resume прежней identity и не публикуют старую сессию/callback. Обработка неверного пароля и лимита попыток сохранена. Неизвестный результат completion по-прежнему восстанавливается через resume — принятие согласий не повторяется.

Архитектура: orchestration остаётся в feature lib. Переиспользованы существующие model mutations и shared transport, RHF UI не менялся. Новых endpoint, backend-веток, схем БД, хранений пароля, экранов или обходов согласий нет. Git index/commit/deploy не затрагивались.

## Проверка

- Новый regression probe, падавший до исправления, теперь PASS: после409 сохраняется loginB, resumeA не вызывается.
- **189/189** клиентских регрессий PASS, включая6новых: отменаA передB, отсутствие pending actor,409/500безresume, сбой отмены без отправки credentials, закрытие owner во время отмены. Прежние проверки completion recovery/callback/session cache/OTP сохранились.
- check-types, scoped ESLint, Prettier, production build, git diff--check — PASS. Сборка25.78с, публикации нет. Backend исходники не менялись, прежний серверный набор228PASS из E2E-прогона не перезапускался повторно без необходимости.
- **Настоящий браузер17 /auth → Nest → PostgreSQL:** старый profile-manualA на «Ваши данные» → reload → корректный loginB → «Завершим вход?»B. Повторено с неверным паролемB: остаётся «Войти»/«Проверьте почту и пароль.»; после исправления пароля — согласияB. Дополнительные согласия не принимались.
- **Read-only devDB:** последний pending flow принадлежит `login@example.test`, статусOPEN; прежний `profile-manual@example.test` —CANCELLED, draftName/draftPhone очищены, исходный User остаётся без контактов. Это подтверждает identity фактически, сверх визуального различия экранов.

Артефакты: verification/auth-retest-2026-10-21/account-switch-fixed.png, account-switch-wrong-password-fixed.png, account-switch-fixed-database.json, account-switch-regression-fixed.log, fix-site-tests.log, fix-types.log, fix-lint.log, fix-build.log. Исторические before screenshots/logFAIL сохранены.

Dev3000/API3002/PG/mailbox оставлены работать. Вкладка17 оставлена на согласиях аккаунтаB, рекламаfalse, Continue не нажат. Ограничения прочего E2E-прогона (внешний Яндекс/Telegram, browserhandoff для новых credential и ожидаемый browsergrant рекламы) не заменяются этим исправлением.
