# Этап12 — production env и backup/restore

Выполнен 21.10.2026 в ветке `codex/email-advertising-consent`, worktree `/Users/denis.voropayev/.codex/worktrees/email-advertising-consent/artmate-monorepo`. HEAD `c3e21a2f` не менялся. Коммита/push/deploy/SSH и обращения к рабочей БД не было. Прежние изменения/index сохранены; основной checkout не затронут.

## Что изменилось

Проверен весь путь новых переменных авторизации/согласий. Он уже был полным; дублирующие env или новый секрет не добавлялись:

| Переменная | GitHub источник | Runtime consumer |
| --- | --- | --- |
| `AUTH_FLOW_PROXY_SECRET` | production `secrets.AUTH_FLOW_PROXY_SECRET` → generated env | Site/API; shared signed request evidence |
| `ADVERTISING_RECIPIENT_HMAC_SECRET` | production `secrets.ADVERTISING_RECIPIENT_HMAC_SECRET` → generated env | API Consents recipient HMAC |
| `ADVERTISING_RECIPIENT_KEY_VERSION` | production `vars.ADVERTISING_RECIPIENT_KEY_VERSION` → generated env | API Consents persisted key version |

Сверены `.github/workflows/deploy.yml`, `docker-compose.prod.yml`, оба env examples, `infra/required-prod-env.txt`, `turbo.json` и фактические readers. Workflow уже выполнял validator и `compose config --quiet`; пробел был в качестве проверки, а не доставке.

`infra/validate-prod-env.sh` теперь проверяет у двух новых ключей length>=32, отсутствие whitespace/известных placeholder prefixes, отличие от JWT и друг от друга. Version — безопасный непустой идентификатор длиной до32. Значения в ошибках не выводятся. Проверка формата не доказывает энтропию: ключи генерируются независимо и хранятся стабильно, не создаются при каждом deploy.

Примеры ключей различаются и намеренно отвергаются production preflight. Для локального `validate`/Compose использован отдельный синтетический overlay, не реальные secrets. Новых env/dependencies нет.

## Копия до миграции

Добавлен `infra/backup-database.sh`. Он читает полный custom archive `pg_dump` через существующий сервис `postgres`, используя его же версию инструментов и credentials внутри контейнера. `DATABASE_URL`/password не передаются с хоста аргументами. Копируется `POSTGRES_DB` этого сервиса; внешний PostgreSQL потребовал бы отдельного adapter. В production надо подтвердить, что API действительно использует эту БД; её `.env` в этой задаче не читался.

Скрипт:

- требует явные env files и абсолютный новый output;
- создаёт новую директорию mode700 и временный файл mode600;
- сохраняет полный snapshot без table allowlist;
- полностью читает и декомпрессирует архив через `pg_restore --file=/dev/null`, не исполняя SQL;
- вычисляет SHA-256, публикует готовый файл эксклюзивной POSIX hard link, не перезаписывая файл/symlink/конкурентный target-directory;
- убирает временный файл при ошибке/signal; в stdout только путь и checksum.

Workflow доставляет script на сервер. Порядок будущего релиза: pull → start postgres → stop API writers → verified snapshot в `/opt/artmate-backups` → migrate → start compatible release. Ошибка копирования/проверки прерывает релиз до миграции и оставляет API остановленным. Это изменение кода workflow, а не выполненный deploy. При частично выполненной миграции старый API автоматически не запускается.

Snapshot включает пользователей/credential hashes/заказы, identity и authentication facts, profile/consent publications, команды и receipts, документ/form bytes и hashes, source/requestContext, grant/revoke timeline и token hashes. Роли PostgreSQL и внешние volumes/secrets не копируются. Backup — конфиденциальная полная БД, не пользовательский evidence export.

## Архитектура и границы

Все production изменения этапа находятся в `infra`, examples и deploy workflow. Бизнес-правила и владение состоянием Auth/Users/Consents/Orders не менялись; frontend не менялся. Новый native test вызывает реальные доменные сценарии только в изолированной среде. Не появились междоменные прямые вызовы в runtime, новые UI состояния, demo panels/adapters или резервная auth система.

Уточнена прежняя проектная формулировка flags: общий Auth UI уже постоянный после удаления заменённых путей, collection использует существующий published registry и Consents decision; direct revoke от него независим. Sender runtime отсутствует (этап11 отложен). Неподключённые UI/send flags и проектный `EMAIL_ADVERTISING_ENABLED` не вводились. Реальные switches возвращаются вместе с соответствующим будущим consumer, а не как пустые env.

Не добавлены архивный volume, export/retention maintenance или рекламные queue/SMTP (этапы10/11 отложены). Нет автоудаления/произвольного срока хранения/расписания backup/автовосстановления. Копия на диске того же VPS не заменяет offsite: внешнее шифрованное хранилище, доступ, вместимость и операционная периодичность restore не настраивались. Это остаётся явной production операционной границей.

Порядок создания копии/изолированного восстановления, обращения с ключами и сверки событий после snapshot — [infra/database-backup.md](../../../infra/database-backup.md). Secrets и key-version mapping сохраняются отдельно в защищённом хранилище. Изменение env само по себе не мигрирует historical recipient keys. Старый snapshot может предшествовать отзыву/платежу/заказу: его нельзя автоматически возвращать в работу без сверки. Подробности инструментов сверены с [PostgreSQL17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) и [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).

## Проверки

| Проверка | Итог |
| --- | --- |
| Infrastructure suite (реальный validator/backup shell + actual deploy shell с command doubles) | **32/32 PASS**, failed/skipped0 |
| Новый native PostgreSQL backup/restore case | **1/1 PASS**, failed/skipped0 |
| `yarn workspace api check-types` | PASS |
| `yarn workspace api check-types:test` | PASS |
| `yarn workspace api lint` и scoped ESLint нового теста | PASS |
| `validate-prod-env` с dummy overlay | PASS, 57 required values + keys |
| Env example без overlay | Ожидаемый отказ placeholder keys, без вывода значений |
| `docker compose ... config --quiet` с dummy overlay | PASS |
| `bash -n` backup/validator, `git diff --check` | PASS |

Infrastructure проверки покрывают short/empty/placeholder/whitespace/JWT reuse/equal keys/version, env overlay без shell execution; частичный/пустой/нечитаемый dump, private modes/checksum, отказ перезаписи/гонки file+directory, cleanup и остановку workflow после failed backup/migration. Реального SSH/Docker engine/production эти command doubles не вызывают.

`apps/api/test/auth-backup.postgres.spec.ts` создаёт две уникальные БД на выделенном loopback PostgreSQL, применяет настоящую историю миграций, создаёт валидный graph через реальные Auth completion и Consents/Users handlers. Настоящий backup script через строгий Docker-command adapter запускает native pg_dump/pg_restore. Затем `pg_restore --single-transaction --exit-on-error --no-owner --no-privileges` восстанавливает архив в пустую БД.

Сравниваются все public table rows (включая JSON/bytea), CHECK/FK, views и non-internal triggers. PostgreSQL при повторном разборе может перенести эквивалентный array cast на элементы; test canonicalization нормализует только это представление. Дополнительно проверено, что immutable acceptance нельзя изменить; duplicate token hash, неверный documentSha256, отсутствующий subscription FK и ACTIVE без grant отвергаются. Рабочий пароль и его hash сохраняются, неправильный пароль отвергается; тот же User/guest Order и его неподтверждённый email сохранены; bytes документов/форм соответствуют hashes. Отозванная подписка остаётся REVOKED. Старая hash-only ссылка работает после restore и реального нового grant, снова переводя её в REVOKED без изменения User/пароля/заказов. Raw capability/cookie не превращаются в evidence.

Native тест выполнен на PostgreSQL15.12 с настоящими pg tools. Production Compose использует17-alpine; matching client находится внутри service. Реальный Docker transport/production17 end-to-end этим не объявляется проверенным. Frontend и API runtime/build output не менялись, повторные browser/site build/full API suite не запускались. Общая приёмка относится к этапу13; прежний full API baseline issue из stage2 этим не закрыт.

Логи/summary/cleanup — [verification/stage-12](./verification/stage-12/README.md). Синтетические dump и обе созданные test DB удалены; свой PostgreSQL62341 остановлен, listener отсутствует. В отчётах нет production secrets или содержимого dump.

## Продолжение

Этап12 завершён в локальном согласованном объёме. Следующий — **13: общая приёмка**, только по отдельному поручению, затем отдельно разрешённый14. Этапы10/11 остаются отложенными. Коммит, deploy, production backup/migration/restore и реальные отправки не выполнялись.
