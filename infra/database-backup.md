# Резервная копия БД авторизации и согласий

`infra/backup-database.sh` создаёт полный логический snapshot одной БД Artmate
через `pg_dump` из работающего сервиса `postgres`. Версия клиента совпадает с
версией сервера Compose (`postgres:17-alpine`). Пароль читается внутри контейнера,
не передаётся аргументом с локальной машины и не выводится в лог. Инструмент
копирует именно `POSTGRES_DB` этого сервиса: перед production запуском проверить,
что `DATABASE_URL` API указывает на ту же БД. Внешний кластер этот adapter не
резервирует.

Custom archive включает схему, данные и ограничения: пользователей, credentials,
заказы, identity/authentication facts, profile/consent publications, команды и
результаты, версии документов/форм с байтами и SHA-256, grant/revoke history,
source/requestContext и hash-only ссылки отписки. Выборочного списка таблиц нет:
новая таблица не выпадет из копии из-за устаревшего allowlist.

Это резервирование БД, а не отложенный evidence export/archive. Файлы uploads,
private coloring/workshop volumes, Studio, роли PostgreSQL, внешние сервисы и
значения GitHub secrets в этот dump не входят. Временные auth drafts и password
hashes входят как часть БД: копия имеет тот же уровень конфиденциальности, что БД.

## Создание

Из каталога развёртывания, после отдельно разрешённого доступа к серверу:

```bash
bash infra/backup-database.sh \
  --env-file .env --env-file .image.env \
  --output /opt/artmate-backups/manual-20261021T010000Z.dump
```

Имя выбирается новое. Скрипт требует абсолютный путь и явные env files, не
выполняет `source` над ними и не перезаписывает существующий файл или symlink.
Новая директория создаётся с mode700, файл — mode600. Сначала создаётся временный
файл рядом с целевым; ненулевой exit `pg_dump`, пустой архив или ошибка полного
чтения/декомпрессии `pg_restore --file=/dev/null` прерывают операцию. Только после
этих проверок архив публикуется эксклюзивной hard link. При ошибке/signal временный
файл удаляется; завершённые старые копии не затрагиваются. В лог попадают только
путь результата и SHA-256. Полное чтение архива не заменяет проверку восстановления.

Deploy workflow после остановки API и до `api-migrate` создаёт
`/opt/artmate-backups/pre-migrate-<UTC>-<PID>.dump`. Ошибка копирования прерывает
workflow, не запускает миграции и оставляет API остановленным. Директория вне
`/opt/artmate`, без public mount и без включения в образ/артефакты GitHub. Копия
создаётся из текущей БД до изменения схемы; это не разрешение запускать старый API
после частично выполненной миграции.

Скрипт не удаляет копии, не назначает срок хранения, не запускает расписание и не
отправляет данные во внешнее хранилище. Для production нужно отдельно определить
закрытое шифрованное хранение вне VPS, доступ, вместимость, срок хранения и
проверяемую периодичность restore. Наличие snapshot на том же диске не защищает
от потери VPS. Эти внешние настройки здесь не объявляются выполненными.

## Проверка восстановления

Использовать только доверенную копию и отдельный пустой PostgreSQL совместимой
версии без приложений, фоновых workers и доступа к внешним сервисам. `pg_restore`
восстанавливает SQL источника; не применять неизвестный архив к рабочему серверу.
Для копии из production17 использовать17 или предварительно проверенную более
новую версию; локальная проверка этапа12 выполнялась на PostgreSQL15.12.

Пример полностью отдельного контейнера. Файл `/secure/restore-test.env` содержит
только три тестовых POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD, без production
секретов; имя БД и пользователя выбираются тестовыми. Порты не публикуются,
network отсутствует:

```bash
docker run --name artmate-restore-check --network none \
  --env-file /secure/restore-test.env -d postgres:17-alpine

docker exec artmate-restore-check sh -ec \
  'pg_isready --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'

# Выполнить после готовности PostgreSQL. Целевая БД должна быть пустой.
docker exec -i artmate-restore-check sh -ec \
  'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore --no-password \
    --single-transaction --exit-on-error --no-owner --no-privileges \
    --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  < /secure/copied-backup.dump
```

Сверить SHA-256 с результатом создания, полный набор таблиц/строк и ограничения,
байты/SHA-256 документов и формы, identity/actor/revision/source/requestContext,
profile и consent receipts, GRANTED→REVOKED timeline и hash-only capabilities.
Проверить сохранённый пароль, привязку заказов к тому же User и отсутствие
разрешения после отзыва. Отдельный regrant/old-link revoke допустим только на
синтетической копии в изолированном тесте, а не на копии данных клиентов.

Воспроизводимая native-проверка репозитория:

```bash
# URL должен вести на отдельный локальный кластер с правом CREATE DATABASE.
ARTMATE_AUTH_TEST_DATABASE_URL=postgresql://TEST_USER@127.0.0.1:TEST_PORT/TEST_DB \
  yarn workspace api test
```

`auth-backup.postgres.spec.ts` создаёт две уникальные БД, применяет реальные
миграции, создаёт валидные факты через доменные обработчики, выполняет скрипт
backup через строгий Docker-command adapter к native PostgreSQL, восстанавливает
в пустую БД, сравнивает полный graph и проверяет поведение. Docker transport
этим тестом не объявляется проверенным на production17; shell/Compose wiring
отдельно покрыт infrastructure tests и `compose config --quiet`.

## Ключи и recovery

`AUTH_FLOW_PROXY_SECRET` одинаков у site/API, но отличается от `AUTH_JWT_SECRET`
и `ADVERTISING_RECIPIENT_HMAC_SECRET`. Recipient HMAC secret — отдельный стабильный
ключ; `ADVERTISING_RECIPIENT_KEY_VERSION` — идентификатор применённого ключа,
а не пароль. Оба новых секрета генерировать независимо, например
`openssl rand -hex 32`, и хранить через production GitHub Environment/secret
manager. Не вставлять значения в команды, Git, runbook, отчёты или dump manifest.
Примеры в репозитории намеренно не проходят production validator; для локальной
проверки используются отдельные синтетические значения.

Обычный deploy не генерирует и не меняет ключи. При восстановлении сохранить
соответствующую конфигурацию секретов и key-version mapping в отдельном защищённом
хранилище; dump её не восстанавливает. Смена proxy secret прерывает in-flight
подписанные proxy requests, смена JWT влияет на сессии. Ротация recipient key и
исторический keyring требуют отдельного согласованного сценария; изменение
значения или версии в env само по себе не мигрирует прежние recipient keys.
Без нового grant ключи не нужны для отзыва по существующей сессии/ссылке; обычный
production preflight всё равно требует полную конфигурацию приложения.

Рабочее восстановление требует отдельного разрешения и плана остановки всех
writers, проверки совместимости кода/схемы и сверки событий после времени
snapshot. Старый snapshot может предшествовать отзыву, оплате или заказу:
до сверки нельзя возвращать такую копию в работу или считать прежний ACTIVE
действующим разрешением на рекламу. Автоматического restore, destructive down
migration и запуска старого API этот этап не добавляет. Рекламного sender runtime
сейчас нет; его gate/queue/SMTP и архив/экспорт отложены с этапами10/11.

Принятые инструменты и ограничения сверены с официальными руководствами
[pg_dump17](https://www.postgresql.org/docs/17/app-pgdump.html) и
[pg_restore17](https://www.postgresql.org/docs/17/app-pgrestore.html).
