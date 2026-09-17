# Запуск партнёрского кабинета

Кабинет публикуется на `https://affiliate.artmate.ru` контейнером `affiliate` на
внутреннем порту `3006`. Этот документ описывает подготовку запуска; live production
в рамках разработки не проверялся.

## Переменные

- `API_BASE_URL=http://api:3002` используется серверными запросами кабинета.
- `AUTH_COOKIE_DOMAIN=.artmate.ru` позволяет общей Artmate-сессии работать на поддомене.
- `NEXT_PUBLIC_SITE_URL=https://artmate.ru` указывает на основной сайт, не на кабинет.
  Значение компилируется в frontend и поэтому должно совпадать при сборке и в runtime.
- `IMAGE_TAG` должен указывать на один и тот же release tag для всех Artmate-образов.

Для сборки используется repository variable `vars.NEXT_PUBLIC_SITE_URL` с безопасным
fallback `https://artmate.ru`. Job публикации не подключён к Environment `production`,
поэтому одноимённая Environment variable ему недоступна. Runtime-значение сериализует
deploy из Environment `production`; оно должно совпадать со значением сборки.

Новых секретов для кабинета нет. Существующий Environment secret
`PRODUCTION_ENV_FILE` остаётся базовым fallback для deploy и дополняется отдельными
vars/secrets. Он не является `workflow input`. Примеры значений находятся в
`.env.example`, `infra/env.prod.example` и `apps/affiliate/.env.example`.

## До запуска

1. DNS `A` для `affiliate.artmate.ru` уже проверен PM и указывает на `186.246.8.79`;
   `AAAA` не опубликован. Перед запуском повторно проверить запись и доступность 80/443.
2. Проверить, что TLS для нового имени может быть выпущен с `ACME_EMAIL`, а старый
   `affiliate.art-mate.ru` нигде не используется.
3. Сделать backup общей PostgreSQL БД перед rollout.
4. Проверить шаблон конфигурации из репозитория командой
   `bash infra/validate-prod-env.sh --env-file infra/env.prod.example` и выполнить
   `docker compose --env-file infra/env.prod.example -f docker-compose.prod.yml config --quiet`.
   Это не проверяет фактические секреты production: workflow отдельно валидирует
   сгенерированный из GitHub env-файл перед отправкой на сервер.

## Сборка и deploy

Merge сам по себе запускает CI, но не публикует production-образы. `Docker Publish`
публикует `artmate-monorepo-affiliate` вместе с остальными образами только по published
release или ручному `workflow_dispatch`. После успешной публикации `Deploy Production`
запускается через `workflow_run`; deploy также можно запустить вручную с нужным tag.
При ручной публикации для текущего автоматического deploy оставляйте tag `latest`:
существующий `workflow_run` выбирает именно его, а не произвольный tag публикации.
Не запускайте ручной deploy с tag, для которого ещё нет полного набора образов.

По решению пользователя локальная Docker-сборка остановлена: окончательная проверка
образа выполняется в GitHub CI на pull request или push в `master`/`main`. До её
успешного завершения образ не считается проверенным.

`Deploy Production` загружает compose/Caddy/env, поднимает PostgreSQL, затем запускает
существующий `api-migrate`, и только после успешной миграции обновляет сервисы одним
`IMAGE_TAG`. Workflow ждёт Docker healthchecks, перезагружает Caddy и проверяет
прямой `200` от `/health`, затем прямой `200` от `/login` без следования redirect.
Redirect на `/unavailable` означает ошибку API и проваливает deploy. Этот план не
подтверждает фактический deploy.

## Smoke checks

1. Проверить `docker compose --env-file .env --env-file .image.env -f docker-compose.prod.yml ps`:
   `affiliate` должен быть `healthy`, Caddy и API должны быть запущены.
2. Открыть `https://affiliate.artmate.ru/login`, проверить TLS, заголовок
   `X-Robots-Tag: noindex, nofollow, noarchive` и отсутствие индексации.
3. Войти существующим партнёрским аккаунтом, открыть обзор и выплаты, затем выйти.
   Обычный пользователь не должен получить доступ к кабинету.
4. Проверить переход восстановления пароля на `https://artmate.ru/auth/recovery`.

## Откат

Для отката используйте предыдущий общий `IMAGE_TAG`, в котором уже существует affiliate
image. Tag до появления affiliate (pre-affiliate) несовместим с новым Compose: образа
`artmate-monorepo-affiliate:<tag>` для него нет. Не откатывайте только affiliate-образ:
frontend, API и схема должны оставаться совместимыми.

Финансовая БД общая; автоматический rollback миграций не выполняется. Backup перед
rollout обязателен. Если новая миграция уже применена, сначала оцените её обратную
совместимость и сохранность журнала начислений/выплат, затем откатывайте приложение.
Не удаляйте и не переписывайте финансовые записи вручную.
