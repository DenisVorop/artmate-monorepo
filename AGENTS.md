# AGENTS.md

Инструкции для AI-агентов, работающих в этом репозитории.

## Общение

- Отвечай пользователю на русском языке.
- Код, команды, пути, API-имена и сообщения ошибок оставляй на языке оригинала.
- Если пользователь явно попросил другой язык, следуй запросу.

## Репозиторий

Монорепозиторий на Yarn workspaces + Turborepo.

- `apps/site` — основной Next.js сайт.
- `apps/api` — backend.
- `apps/docs` — документация.
- `packages/ui` — общие UI-компоненты.
- `packages/eslint-config` и `packages/typescript-config` — общие конфиги.

Основные команды из корня:

```bash
yarn build
yarn lint
yarn check-types
yarn format
```

Для `site`:

```bash
yarn workspace site lint
yarn workspace site check-types
yarn workspace site build
```

Коммиты должны быть Conventional Commits.

## Архитектура `apps/site`

Проект использует FSD-подобную структуру. Импорты между слоями идут только вниз.

```text
app/                         Next.js App Router, тонкие route-файлы
src/_app/                    layouts, providers, shell
src/_pages/                  сборка страниц
src/features/                пользовательские сценарии и клиентская оркестрация
src/entities/                доменные модели, read UI, cards
src/widgets/                 header/footer
src/shared/                  shared ui, constants, lib, actions
```

### Правила слоев

- `app/` содержит только route binding. Никакой бизнес-логики.
- `src/_pages/` собирает страницу из статичных page-ui блоков и features. Логика состояния, фильтрации, форм, мутаций и пользовательских сценариев здесь запрещена.
- `src/features/` содержит интерактивные сценарии, context/provider, формы, фильтры, списки, клиентскую orchestration.
- `src/entities/` содержит доменные типы, read-модели, карточки и entity UI. Entity не должна координировать сценарии.
- `src/shared/ui` содержит shadcn/ui primitives и общие dumb-компоненты.

## UI и shadcn/ui

- Максимально используй существующие shadcn/ui компоненты из `@/shared` или `@/shared/ui`.
- Если нужен новый shadcn primitive, добавляй через `npx shadcn add <component>` из `apps/site`.
- Не пиши самодельные inputs/dropdowns/cards/buttons, если есть shadcn/ui аналог.
- Локальные стили допустимы, но сначала держись дефолтной стилистики библиотеки и проекта.
- Не создавай папку с `index.tsx`, если внутри фактически один компонент. Предпочитай `component-name.tsx`.
- Внутри одной feature UI-компоненты могут импортировать друг друга напрямую относительными путями.

## Naming

- Не добавляй лишний префикс контекста в именах файлов и компонентов. Например, внутри `features/catalog` не нужны имена вида `catalog-filters.tsx`, если достаточно `filters.tsx`.
- Page-local static UI может называться коротко: `hero.tsx`, `heading.tsx`, `cta.tsx`.
- Названия должны отражать роль в текущем slice, а не весь путь.

## `model` и `lib`

- В feature `model` используется для data/query слоя: запросы к backend/DB, query options, mutations, contracts.
- UI-state, фильтрация на клиенте, форматтеры, URL helpers и provider logic не должны лежать в `model`.
- Для UI-state используй `lib/<domain>-state.ts`.
- Все, что относится к provider, хранится в папке `lib/<feature>-provider/`.

Пример структуры provider:

```text
src/features/catalog/lib/catalog-provider/
  catalog.context.tsx
  catalog-provider.tsx
  use-catalog.ts
  with-catalog.tsx
  index.ts
```

Provider должен подключаться через HOC:

```tsx
function BaseCatalog() {
  return (
    <>
      <Filters />
      <List />
    </>
  );
}

export const Catalog = withCatalog(BaseCatalog);
```

## Каталог

Текущая структура catalog feature:

```text
src/features/catalog/
  index.ts
  lib/
    catalog-state.ts
    index.ts
    catalog-provider/
      catalog.context.tsx
      catalog-provider.tsx
      use-catalog.ts
      with-catalog.tsx
      index.ts
  ui/
    catalog.tsx
    filters.tsx
    list.tsx
    summary.tsx
    empty-state.tsx
```

Правила для каталога:

- `src/_pages/catalog/index.tsx` должен оставаться тонким: статичный hero, разделители и `<Catalog />`.
- Фильтрация, сортировка, active filters, empty state и список товаров живут в `features/catalog`.
- `ui/catalog.tsx` собирает полную feature из `filters.tsx` и `list.tsx`.
- `list.tsx`, `summary.tsx`, `empty-state.tsx` — отдельные sibling UI-элементы, а не вложенные файлы внутри папки `list`.
- Empty state не должен импортироваться из `_pages` в feature.
- Metadata каталога не должна перечислять конкретные тематики, если список тематик может расти.
- Если первая картинка товара становится LCP, eager/high priority ставь точечно только на первый above-the-fold item, а не на все карточки.

## Product entity

- Типы, категории и mock/read data товаров живут в `entities/products`.
- `ProductCard` относится к entity и не должен знать о конкретной feature.
- Feature может передавать в `ProductCard` display/optimization props, например `eagerImage`, но сценарная логика остается в feature.

## Проверки

После изменений в `apps/site` запускай минимум:

```bash
yarn workspace site check-types
yarn workspace site lint
```

Если затронуты route boundaries, metadata, Next Image, app router или imports между слоями, дополнительно запускай:

```bash
yarn workspace site build
```

## Git

- Не откатывай чужие изменения.
- Перед commit проверяй `git status --short` и staged diff.
- Коммиты делай только по явному запросу пользователя.
