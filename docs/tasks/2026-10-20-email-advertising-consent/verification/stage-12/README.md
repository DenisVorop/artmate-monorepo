# Проверки этапа12 · 21.10.2026

Полный отчёт — [stage-12-report.md](../../stage-12-report.md).

- `infra-tests-final.log`:32/32 PASS. Реальный shell validator/backup, failure/permissions/checksum/concurrency cases; реальный remote deploy shell block с in-memory command doubles (без SSH).
- `native-backup-restore.log`:1/1 PASS. Две уникальные test DB на loopback62341, real migrations/Auth/Users/Consents graph и native pg_dump/pg_restore15.12. Вызывается actual backup script через strict Docker-command adapter; затем empty DB restore, full row/schema/bytes compare, password/guest Order и old-token revoke после реального regrant. Не production17/Docker engine E2E.
- Native test source — `apps/api/test/auth-backup.postgres.spec.ts`; fixtures только синтетические. Dump содержимое не сохраняется здесь, обе DB и archive удалены.
- `api-types.log`, `api-test-types.log`, `api-lint.log`, `api-backup-test-lint.log`: PASS. Пустой scoped ESLint log означает exit0, а не пропуск; итог подтверждён summary/report. Runtime sources/frontend/build output не менялись, общие site/browser/fullAPI checks не повторялись.
- `env-validation.log`:57 required values + key checks PASS с synthetic overlay. Значения overlay сюда не копируются и не являются настоящими secrets. `example-env-expected-rejection.log`:placeholder keys корректно отвергнуты, значения не печатаются.
- `compose-config.log` и `shell-syntax.log`: exit0, quiet commands. Compose parser использует example + synthetic overlay; контейнеры/production не запускаются.
- `root-cleanup.json`:test DB count0, synthetic dump удалён, собственный PG62341 остановлен/listener отсутствует. `final-checkpoint.log`:branch/HEAD/diff check.
- `format.log`/`api-test-format.log`:точечное форматирование новых test files; не запускался repo-wide format.

Повторные stdout timings и представление DDL не являются отдельными tests. Для schema comparison нормализуется только эквивалентный array cast; negative constraints проверяют actual restored DB. Проверки охватывают все public rows, а не выборочную выгрузку evidence.

Нет production `.env`/secrets/dumps, SSH, SSO/SMTP/Telegram/payment запросов, GitHub settings, commit/push/deploy. Offsite encrypted storage/retention/schedule и реальные production restore не настраивались; runbook фиксирует эти ограничения.10/11 отложены, следующий13 только по отдельному поручению.
