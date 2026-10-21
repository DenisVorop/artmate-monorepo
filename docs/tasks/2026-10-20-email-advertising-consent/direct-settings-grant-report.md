# Прямое согласие из настроек — 21.10.2026

Пользователь изменил сценарий: переключатель «Скидки и акции» сам выражает рекламное согласие; Auth-модалка при нём не открывается. Предыдущая реализация этапа9 через onAuth заменена. Текст «Экономьте на акциях и распродажах.», отсутствие бейджа и ссылки в этом блоке сохранены.

## Реализация

- Feature settings вызывает отдельный useGrantSubscription → shared server action → POST /consents/email-advertising/grant. HOC/useAuth удалены из этого сценария. Остальные формы/авторизация продолжают использовать общий Auth; модальный сценарий там не заменялся.
- AuthGuard проверяет текущую сессию. Consents получает actor/email только с сервера, читает Users publication, проверяет активный аккаунт и реальную дату подтверждения именно этого адреса. Узкая Users-owned read-lock publication удерживает статус/email/подтверждение до коммита; Consents не меняет Users и не читает его частные поля напрямую.
- Запрос несёт revisionId, expectedVersion и expectedStateRevision. Registry и recipient locks сериализуют выдачу/отзыв; две версии защищают в том числе OFF до появления subscription, когда permission version ещё0. Повтор того же ON идемпотентен; старый ON после OFF не восстанавливает подписку.
- Существующая неизменяемая EmailAdvertisingConsentEvent дополнена nullable emailVerifiedAtSnapshot. CHECK допускает ровно старую Auth provenance либо settings provenance с verified-email snapshot/actor/source notification_settings. SQL trigger повторно проверяет живую Users publication и опубликованную ads revision. Дата/actor/email/revision/source/requestId/полный доступный очищенный requestContext сохраняются. Никаких initial/final checked/continue полей нет.
- Общая запись grant/HMAC/history/projection выделена в Consents utility и переиспользована прежним Auth handler. Настройки не создают фиктивную Auth operation, не перевыдаёт JWT, не принимают ПДн и не меняют credential/profile/orders. user_consent_states меняет только revision, сохраняя requiredAcceptances.
- Status API всегда публикует обязательный stateRevision. grantRevisionId опционален лишь из-за возможного отсутствия опубликованной редакции: это не блокирует отзыв. Grant server action требует signed upstream evidence, revoke сохраняет прежнюю независимость от grant/proxy keys. Owner-fenced cache учитывает обе версии, состояние Switch меняется только по подтверждённому серверному результату; ошибка не показывает ложный успех.

## Проверки

- 143/143 реальные Auth/Consents HTTP+PostgreSQL проверки PASS,0skip. Новые cases: no Auth/PDn/profile effects, auth/CSRF/extra fields/verified account, duplicate/concurrent ON, stale ON after already-off fence, regrant/old unsubscribe link, stale revision/missing key rollback. Все прежние Auth gates/guest/session/Yandex-policy/withdrawal cases сохранены.
- 20/20 PGlite migration tests PASS,0skip. Новые cases проверяют settings provenance, NULL/mixed binding/чужой actor/email/date/unverified, неподходящие/неопубликованные/retired документы, immutable event и атомарность deferred projection.
- 592/592 site tests PASS,0skip. Старые auth-toggle tests заменены direct grant tests; transport payload/context, unknown acknowledgement, owner/race/cache/ошибки и revoke покрыты.
- API build/typecheck/test-types/lint и site build/types/scoped lint PASS; Prettier/diff/cached diff PASS. Новых зависимостей/env/flags нет.

## Живой dev

Новая migration 20261021120000_settings_advertising_grant применена только к dedicated localhost62371/artmate_auth_dev. Счётчики до/после schema change: users9/orders2/events4 → те же значения. Рабочая/production БД и SSH не использовались. Перезапущен только наш API, PID62371 (порт3002); служебный /tmp/artmate-auth-dev/processes.json обновлён. Next3000/PG62371/mailbox8025/SMTP2525 оставлены для ручной приёмки.

Пользователь отдельно разрешил включить и выключить настройки signup-next@example.test. В реальном браузере ON → switch true/«Подписка включена.» без Auth dialog (count0), reload → true; OFF → false/отписка, reload → false. Текущая вкладка оставлена на settings с подпиской OFF. Read-only DB assertion9/9 PASS: ровно GRANTED→REVOKED, конечное revoked/version2, notification_settings, Auth operation/identity refs null, точная исходная дата подтверждения и actor/email, revision, signed full upstream context; users/orders не изменились и добавлены ровно два события.

Реальные рекламные отправки не выполнялись: этапы10/11 отложены. Commit/push/deploy/публикации не было, прежний index сохранён. Stage14 по-прежнему остановлен; будущий выпуск требует актуального snapshot новых форм, старый release bundle не является текущим.
