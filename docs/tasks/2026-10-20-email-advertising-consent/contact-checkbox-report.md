# Контактная форма без авторизации — 21.10.2026

Пользователь подтвердил снятие обязательного входа у контактной формы. Подготовленный server patch применён после этого решения.

## Поведение и архитектура

- ContactForm отправляет обращение без withAuth/useAuth и Auth modal.
- Чекбокс ПДн изначально выключен. RHF/zod и backend DTO требуют boolean true; false, отсутствие, null, число и строка отклоняются.
- UI отвечает за поля/ошибки, lib — за form state/mapper/orchestration, model — за mutation, shared/actions — за transport. Страницы собирают features.
- Поля сохраняются после ошибки; повторная отправка блокируется. Успех показывается после server sent=true.
- Email служит для ответа. Отправка не создаёт User, identity proof, Auth flow, account acceptance или рекламное согласие. Владение email не утверждается.
- Server action передаёт JSON/CSRF/IP без access cookie. ContactsModule не зависит от Auth. PartnerApplications сохраняет независимый guard.

## Проверки перед коммитами

- 607/607 site tests; site types/lint и production build PASS.
- 230/230 targeted API tests без skips: 145 PostgreSQL/HTTP и 85 security/contracts/provider tests. Telegram заменён тестовым transport.
- Anonymous HTTP + true: 201/sent=true, без cookies и без User/VerifiedIdentityFact/AuthPendingFlow/AuthCompletionOperation/RequiredConsentAcceptance/EmailAdvertisingSubscription/ConsentEvent.
- False/missing/string/number/null: 400, без уведомлений и User.
- Partner: anonymous/pending rejection, user/acceptance provenance и отсутствие рекламы сохранены.
- Production module resolution 1/1; API types/test-types/lint/build PASS.
- Admin/affiliate types/lint; 30 infra tests; synthetic env validation/Compose config; diff check PASS.
- Browser /contacts: синтетические поля, выключенный чекбокс блокирует submit, короткая ошибка, dialogs=0. Согласия в браузере не принимались.
- Исправлен Telegram UI harness: подмена Skeleton и проверка loading без активных controls; три прежних падения устранены.

Настоящая доставка Telegram не проверялась: локальные ключи отсутствуют. Dev API перезапущен только в собственном локальном окружении. Сборка сайта — с NODE_ENV=production. Реальные платежи, внешние сообщения и production не затронуты.

Логи и contact-no-auth.png: /tmp/artmate-commit-checks. Полный гостевой платёж остаётся ограничен отсутствием dev-настроек доставки/эквайринга.
