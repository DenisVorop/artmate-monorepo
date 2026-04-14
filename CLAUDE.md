# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Коммуникация

- Всегда общаться с пользователем на русском языке.
- Код, команды, пути к файлам, названия API и сообщения об ошибках оставлять на языке оригинала.
- Если пользователь явно попросит другой язык — следовать этому запросу.

## Обзор монорепозитория

Yarn workspaces монорепозиторий под управлением Turborepo. Требуется Node >=18 (`.nvmrc` фиксирует 22.13).

- **apps/api** — NestJS бэкенд
- **apps/site** — Next.js 16 основной фронтенд магазина (главное приложение)
- **apps/docs** — Next.js 16 сайт документации
- **packages/ui** — общая библиотека React-компонентов (`@repo/ui`)
- **packages/eslint-config** — общие ESLint-конфиги (`@repo/eslint-config`)
- **packages/typescript-config** — общие TS-конфиги (`@repo/typescript-config`)

## Команды

Все команды запускаются из корня репозитория, если не указано иное. Turbo кэширует build/lint/check-types; `dev` не кэшируется и persistent.

```bash
# Корень (все apps/packages)
yarn build          # Сборка всего
yarn dev            # Dev всех приложений одновременно
yarn lint           # Линтинг всего (max-warnings 0)
yarn format         # Форматирование Prettier (TS/TSX/MD)
yarn check-types    # Проверка типов везде

# Фильтрованный запуск (одно приложение)
yarn dev --filter=site     # site на :3000
yarn dev --filter=api      # api через ts-node
yarn dev --filter=docs     # docs на :3001
yarn build --filter=site
yarn lint --filter=site

# Внутри apps/site или apps/api
yarn lint
yarn lint:fix        # только site
yarn check-types
```

Сообщения коммитов должны следовать Conventional Commits — проверяется `commitlint` через Husky хук `commit-msg`.

## Архитектура apps/site (FSD)

Сайт использует вариант Feature-Sliced Design со следующими слоями (зависимости импортов идут только вниз):

```
app/                     ← только файлы Next.js App Router (тонкие обёртки)
src/_app/  (@/app)       ← глобальные layouts, providers, application shell, SSR data builders
src/_pages/ (@/pages)    ← page controllers: чтение params, SSR prefetch, сборка экрана
src/features/ (@/features) ← пользовательские сценарии, формы, mutations, клиентская оркестрация
src/entities/ (@/entities) ← доменные модели, query options, read hooks, derived state
src/widgets/ (@/widgets)  ← только site-header и site-footer
src/shared/  (@/shared)   ← утилиты; shared/actions — SSR/BFF граница с backend API
```

### Правила слоёв

**`app/`** — только route-файлы. `page.tsx` реэкспортирует page controller из `src/_pages`. Никакой бизнес-логики, никаких прямых обращений к бэкенду.

**`src/_pages`** — читает route/search params, запускает SSR prefetch через React Query (`prefetchQuery`/`prefetchInfiniteQuery`), настраивает `HydrationBoundary`, обрабатывает `notFound`/redirects. Никогда не управляет формами и мутациями.

**`src/features`** — все интерактивные пользовательские сценарии: формы, submit flows, mutations, диалоги, оркестрация нескольких entities. Типовая структура slice: `ui/`, `model/`, `lib/`, `constants/`, `index.ts`.

**`src/entities`** — доменные read-модели. Предоставляет query options, read hooks, форматтеры, card-компоненты. Никогда не координирует многошаговые сценарии.

**`src/widgets`** — только `site-header` и `site-footer`. Интерактивная логика внутри них живёт в features (например, кнопка корзины → `features/cart`).

**`shared/actions`** — server actions, вызывающие сгенерированный API клиент, нормализующие DTO, добавляющие auth-контекст. Никогда не импортирует React UI или entities/features.

### Добавление новой функциональности — порядок действий

1. Backend contract → `shared/actions/<domain>`
2. Доменная read-модель → `entities/<entity>`
3. Пользовательский сценарий → `features/<feature>`
4. Сборка страницы → `src/_pages/<page>`
5. Глобальная оболочка (только если меняется header/footer) → `widgets/`
6. Route binding → тонкий файл в `app/`

### Client/server границы

- Компоненты по умолчанию являются Server Components; `'use client'` добавляется только там, где нужны hooks, события, формы, browser API или клиентские React Query hooks.
- Данные, пересекающие server/client boundary, должны быть сериализуемыми.
- `shared/actions` вызываются из клиентских features через паттерн Next.js server actions.

### Публичный API slice

Импорты между slices — через экспорты `index.ts`. Внутренние файлы slice используют относительные импорты только внутри своего slice. Глубокий внутренний импорт извне slice — сигнал добавить явный экспорт или пересмотреть границу slice.

### Сгенерированный API-код

Сгенерированный API клиент не правится руками. После изменения OpenAPI/Orval inputs нужно перезапустить генерацию. Слой `shared/actions` скрывает нестабильность сгенерированных DTO от UI.

Главная страница: https://www.figma.com/design/SyODtFDOAPJPcxJOhKF3DD/Untitled?node-id=1-2&t=oXVNnN5sgS2pGVpO-1
Каталог: https://www.figma.com/design/SyODtFDOAPJPcxJOhKF3DD/Untitled?node-id=2-1084&t=oXVNnN5sgS2pGVpO-1
Карточка товара: https://www.figma.com/design/SyODtFDOAPJPcxJOhKF3DD/Untitled?node-id=2-1625&t=oXVNnN5sgS2pGVpO-1
Контакты: https://www.figma.com/design/SyODtFDOAPJPcxJOhKF3DD/Untitled?node-id=2-2112&t=oXVNnN5sgS2pGVpO-1
Блог: https://www.figma.com/design/SyODtFDOAPJPcxJOhKF3DD/Untitled?node-id=2-2394&t=oXVNnN5sgS2pGVpO-1
Статья: https://www.figma.com/design/SyODtFDOAPJPcxJOhKF3DD/Untitled?node-id=2-2744&t=oXVNnN5sgS2pGVpO-1
Галерея работ: https://www.figma.com/design/SyODtFDOAPJPcxJOhKF3DD/Untitled?node-id=2-3151&t=oXVNnN5sgS2pGVpO-1
Открытая работа: https://www.figma.com/design/SyODtFDOAPJPcxJOhKF3DD/Untitled?node-id=2-3353&t=oXVNnN5sgS2pGVpO-1
FAQ: https://www.figma.com/design/SyODtFDOAPJPcxJOhKF3DD/Untitled?node-id=2-3597&t=oXVNnN5sgS2pGVpO-1
Корзина: https://www.figma.com/design/SyODtFDOAPJPcxJOhKF3DD/Untitled?node-id=3-4023&t=oXVNnN5sgS2pGVpO-1
Оформление заказа: https://www.figma.com/design/SyODtFDOAPJPcxJOhKF3DD/Untitled?node-id=3-4459&t=oXVNnN5sgS2pGVpO-1