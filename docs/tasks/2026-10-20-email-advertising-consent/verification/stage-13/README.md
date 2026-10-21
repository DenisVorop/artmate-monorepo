# Этап 13 — материалы общей приёмки

Свежие результаты от 21.10.2026; основной вывод и ограничения — [отчёт](../../stage-13-report.md), [карта покрытия](../../stage-13-acceptance.md). Исторические этапы не прибавлялись к текущим числам.

- [summary.json](./summary.json):1795 реально выполненных API,577site,123affiliate,32infra tests;92уникальные browser и9standalone HTTP checks PASS. Отдельные opt-in PG skips указаны в [backend summary](./backend/summary.json).
- [backend](./backend): первый baseline с4fail, исправленные16regression, окончательный full API и Prisma/types/test-types/lint/build. Runtime backend не менялся.
- [frontend](./frontend): последние site tests/types/lint/build после всех исправлений, affiliate tests/types/lint/build и admin types/lint. Не смешивать с промежуточными targeted логами.
- [targeted](./targeted): адресные проверки изменений (перекрываются с полными suites и отдельно к totals не суммируются).
- [browser](./browser/README.md): actual Next production build+внешний локальный HTTP fixture, final92checks, screenshots/все PDF pages, исходные findings и clearing, drivers/network/cleanup. Внутренние абсолютные пути в captured JSON относятся к исходному временному запуску; рядом сохранены файлы с теми же basename/структурой.
- [standalone](./standalone/checks.json): Docker-shaped копия Node bundle,9HTTP проверок, privacy/PDF/source bytes/assets. Это не Docker engine/image и не backend E2E. В probe.py сохранены исходные временные пути, для повторения их нужно заменить. Сам bundle/public copy/Node runtime не архивируются.
- [infra](./infra), [Caddy](./caddy):32infra tests, dummy57env/Compose/shell, actual loopback HTTP200/502/privacy/redaction/strictCOOP. Использованы синтетические env/fixtures; production secrets не записывались. Caddy binary не архивируется.
- [architecture-audit.md](./architecture-audit.md): read-only source и две delta-сверки; не подменяет runtime evidence.
- [cleanup.json](./cleanup.json): собственные listeners отсутствуют; [PostgreSQL cleanup](./postgres-cleanup.json) подтверждает отсутствие test schemas/backup DB и остановку cluster. Browser/standalone имеют собственные cleanup records.

Рабочая БД/SSH/реальные SMTP/SSO/платежи не использовались. Нет commit/push/deploy/registry publication. Все fixtures и capabilities синтетические. Legal renderer не подтверждает юридическое согласование, full-site accessibility/performance не заявлены. Этапы10/11 отложены,14 отдельно.
