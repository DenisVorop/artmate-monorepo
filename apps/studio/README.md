# Artmate Studio

Отдельный интерфейс книг раскрасок. `/` — проекты, `/projects/<uuid>` — постоянный адрес книги.
Книга содержит до 100 страниц: множественная загрузка, общие параметры и переопределения,
очередь, просмотр и принятие результатов, перестановка, SVG/PNG ZIP всей книги.

Локально: `yarn workspace studio dev` (3005), Python API — 8000. `/api/studio` проксируется
в dev; production использует Caddy на studio.artmate.ru. Существующие Artmate API и страницы
раскрасок не используются. Авторизация — отдельная cookie студии.

Проверки: `yarn workspace studio check-types`, `yarn workspace studio lint`,
`yarn workspace studio build`; ручная проверка пакетной загрузки, постоянной ссылки,
настроек, порядка и экспорта. API, лимиты и запуск описаны в services/coloring/README.md.
