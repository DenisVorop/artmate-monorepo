# AGENTS.md

Инструкции для AI-агентов, работающих в этом репозитории.

## Общение

- Отвечай пользователю на русском языке.
- Код, команды, пути, API-имена и сообщения ошибок оставляй на языке оригинала.
- Если пользователь явно попросил другой язык, следуй запросу.

## Репозиторий

Монорепозиторий на Yarn Classic workspaces + Turborepo.

- Node: ориентируйся на `.nvmrc` (`22.13`), при этом `package.json` допускает `>=18`.
- Package manager: `yarn@1.22.22`. Не добавляй lock-файлы других менеджеров.
- `README.md` пока в основном starter-шаблон Turborepo, не используй его как единственный источник правды.

Workspaces:

- `apps/site` — основной Next.js сайт Artmate.
- `apps/api` — backend на NestJS.
- `apps/docs` — Next.js docs app, сейчас близко к starter-шаблону.
- `packages/ui` — stub React UI package для shared workspace-компонентов.
- `packages/eslint-config` и `packages/typescript-config` — общие конфиги.

Основные команды из корня:

```bash
yarn dev
yarn build
yarn lint
yarn check-types
yarn format
```

`yarn format` пишет изменения во все `**/*.{ts,tsx,md}`, поэтому не запускай его без необходимости, если задача точечная.

Workspace-команды:

```bash
yarn workspace site dev
yarn workspace site lint
yarn workspace site check-types
yarn workspace site build

yarn workspace api dev
yarn workspace api lint
yarn workspace api check-types
yarn workspace api build

yarn workspace docs dev
yarn workspace docs lint
yarn workspace docs check-types
yarn workspace docs build

yarn workspace @repo/ui lint
yarn workspace @repo/ui check-types
```

Порты по умолчанию:

- `site` — `3000`.
- `docs` — `3001`.
- `api` — `3002`, можно переопределить через `PORT`.

Коммиты должны быть Conventional Commits. Husky запускает `yarn commitlint --edit "$1"`.

## Архитектура `apps/site`

`apps/site` — Next.js 16 + React 19, App Router, TypeScript, Tailwind CSS v4, shadcn/ui (`radix-nova`), TanStack Query.

Алиасы из `apps/site/tsconfig.json`:

```text
@/app/*       -> src/_app/*
@/pages/*     -> src/_pages/*
@/features/*  -> src/features/*
@/entities/*  -> src/entities/*
@/widgets/*   -> src/widgets/*
@/shared/*    -> src/shared/*
```

Проект использует FSD-подобную структуру. Импорты между слоями идут только вниз.

```text
app/                         Next.js App Router, route binding
src/_app/                    root layouts, providers, data builders, app-level types
src/_pages/                  сборка страниц, page-local static UI, metadata
src/features/                пользовательские сценарии и клиентская orchestration
src/entities/                доменные типы, query options/hooks, selectors, read UI
src/widgets/                 крупные layout widgets
src/shared/                  shared ui, constants, lib, actions, primitives
```

### Правила слоев

- `app/` содержит route binding: экспорт metadata, `generateStaticParams`, `generateMetadata`, вызов data builder, `HydrationBoundary`, `notFound`-валидацию. Не размещай здесь page UI и бизнес-сценарии.
- `src/_app/` содержит root layout, providers и data builders. Data builders могут импортировать query options/actions нужных slices для prehydrate, но не должны становиться UI-слоем.
- `src/_pages/` собирает страницу из статичных page-ui блоков, entities и features. Логика фильтрации, форм, мутаций и пользовательских сценариев здесь запрещена. Page wrapper может читать hydrated entity query для page-level `DataState`.
- `src/features/` содержит интерактивные сценарии, client state, context/provider, формы, фильтры, списки и orchestration.
- `src/entities/` содержит доменные типы, query options/hooks, selectors, read-модели, карточки и entity UI. Entity не должна координировать сценарии.
- `src/widgets/` содержит переиспользуемые крупные блоки layout уровня.
- `src/shared/` не импортирует верхние слои. `shared/actions` — текущий server/mock API слой.

Внешние импорты slice делай через public API (`index.ts`), если он есть. Внутри одного feature/entity/ui-слайса sibling UI-компоненты могут импортировать друг друга напрямую относительными путями.

## Data Flow и Query

Текущий read data flow в `site`:

```text
src/shared/actions/<domain>/*.actions.ts
  -> src/entities/<domain>/model/query.ts
  -> src/entities/<domain>/model/use-*.ts
  -> src/_app/lib/*-data-builder.ts
  -> app/**/page.tsx + HydrationBoundary
  -> src/_pages/** и src/features/**
```

Правила:

- `shared/actions` сейчас хранит server actions и mock/read data. Actions помечаются `"use server"` и возвращают `ApiResultDTO<T>` через `ApiResult.prepareApi(...)`, если это доменные read-запросы.
- Entity `model/query.ts` экспортирует `queryOptions(...)` со стабильным `queryKey`, обычно `staleTime: Infinity` и `retryOnMount: false` для статичных read/mock данных.
- Entity hook (`use-*.ts`) должен быть отдельным `"use client"` файлом и оборачивать `useQuery(...)`.
- Для SSR/RSC prefetch используй data builders из `src/_app/lib`. Они кладут данные в `QueryClient` через `setApiResultQueryData(...)` или `prefetchQuery(...)`.
- В route-файлах обезвоживай query client только через `dehydrateQueryClient(queryClient)`, потому что он сохраняет и error-состояния.
- Для динамических страниц проверяй данные после build/prefetch и вызывай `notFound()` в route, если route params невалидны.
- Новую hydrated страницу добавляй по цепочке: `shared/actions` -> entity query/hook -> data builder -> route `HydrationBoundary` -> page/feature UI.
- `QueryStateProvider` в `shared/lib/query-state-manager` уже подключен в `AppProviders`; используй его для URL search params только когда состояние действительно должно жить в URL.

## `model` и `lib`

- В feature `model` используется для data/query слоя: query options, mutations, contracts, запросы к backend/DB.
- UI-state, фильтрация на клиенте, форматтеры, URL helpers и provider logic не должны лежать в `model`.
- Для UI-state используй `lib/<domain>-state.ts`.
- Все, что относится к provider, хранится в папке `lib/<feature>-provider/`.

Provider-структура должна быть предсказуемой:

```text
src/features/<feature>/lib/<feature>-provider/
  <feature>.context.tsx
  <feature>-provider.tsx
  use-<feature>.ts
  with-<feature>.tsx
  index.ts
```

Provider подключай через HOC:

```tsx
function BaseFeature() {
  return (
    <>
      <FeatureControls />
      <FeatureContent />
    </>
  );
}

export const Feature = withFeature(BaseFeature);
```

## Slice Architecture

Каждый domain slice должен иметь ясную границу ответственности и public API.

### Entity slice

Рекомендуемая форма:

```text
src/entities/<entity>/
  index.ts
  model/
    query.ts
    types.ts
    use-<entity-data>.ts
    index.ts
  lib/
    <entity>-selectors.ts
    index.ts
  ui/
    <entity-card>.tsx
    <entity-summary>.tsx
```

Правила:

- `model/types.ts` описывает доменную read model. Если source of truth временно находится в `shared/actions`, entity может переэкспортировать типы оттуда.
- `model/query.ts` содержит query options и query keys, но не client UI-state.
- `model/use-*.ts` содержит client query hooks и всегда помечается `"use client"`.
- `lib/*-selectors.ts` содержит чистые selectors и derived read helpers.
- `ui/*` содержит read-only отображение entity. Допустим локальный UI-state для презентации, но не orchestration пользовательского сценария.
- `index.ts` экспортирует только внешний контракт slice; не экспортируй внутренние детали без необходимости.

### Feature slice

Рекомендуемая форма:

```text
src/features/<feature>/
  index.ts
  model/
    query.ts
    mutation.ts
  lib/
    <feature>-state.ts
    <feature>-provider/
  ui/
    <feature>.tsx
    controls.tsx
    list.tsx
    empty-state.tsx
```

Правила:

- Feature отвечает за сценарий: пользовательские действия, filters/search/sort, form state, mutations, active selection, optimistic UI, composition нескольких entities.
- `ui/<feature>.tsx` собирает feature из sibling UI-компонентов и подключает provider/HOC, если он нужен.
- `lib/<feature>-state.ts` содержит чистую client-side логику состояния, фильтрации, сортировки и derived view data.
- `model` в feature используй только для data/query/mutation слоя сценария. Не клади туда форматтеры, URL helpers и client-only filters.
- Empty/error/loading states сценария должны жить в feature, если они зависят от состояния сценария. Общие dumb states можно брать из `shared/ui`.
- Feature может передавать entity UI display/optimization props, но entity UI не должна знать, из какой feature она вызвана.

### Page slice

Рекомендуемая форма:

```text
src/_pages/<page>/
  index.tsx
  metadata/
    index.ts
  ui/
    hero.tsx
    section.tsx
```

Правила:

- Page slice собирает route-level experience из page-local static UI, entities, widgets и features.
- Page-local `ui` подходит для статичных секций, layout и контента, привязанного к одной странице.
- Не размещай в `_pages` бизнес-сценарии, фильтрацию, form mutations и provider orchestration.
- Page wrapper может показывать page-level `DataState`, если hydrated data отсутствует или пришла с ошибкой.

### Shared slice

- `shared/ui` — shadcn primitives и общие dumb-компоненты без доменной логики.
- `shared/lib` — инфраструктурные helpers, query client, hydration, event/query-state managers, API result wrappers.
- `shared/constants` — маршруты, внешние ссылки и site config.
- `shared/actions` — временный server/mock API слой. Не импортируй из него напрямую в UI, если для домена уже есть entity query/hook.
- `shared` не должен импортировать `_pages`, `features`, `entities` или `widgets`.

## UI и shadcn/ui

- Максимально используй существующие shadcn/ui компоненты из `@/shared/ui`.
- Если нужен новый shadcn primitive, добавляй через `npx shadcn add <component>` из `apps/site`.
- `components.json` настроен на `style: "radix-nova"`, `rsc: false`, `iconLibrary: "lucide"`, aliases в `@/shared`.
- Не пиши самодельные inputs/dropdowns/cards/buttons, если есть shadcn/ui аналог.
- Локальные стили допустимы, но сначала держись дефолтной стилистики библиотеки и проекта.
- Используй `cn` из `@/shared/lib` или `@/shared/lib/utils`.
- Для статусов загрузки/ошибки/пустых данных используй общий `DataState`, если он подходит.
- Иконки бери из `lucide-react`, если подходящая иконка уже есть.
- Не создавай папку с `index.tsx`, если внутри фактически один компонент. Предпочитай `component-name.tsx`.
- Tailwind v4 подключен через `app/globals.css`, без отдельного `tailwind.config`.
- Глобальные design tokens и utilities держи в `app/globals.css` только если они действительно общие.
- SVG в `apps/site` настроены через SVGR: обычный import дает React-компонент, import с `?url` используй для URL-файла.
- `next.config.js` разрешает remote images только с `images.unsplash.com`; для других remote images обнови `images.remotePatterns`.

## Naming

- Не добавляй лишний префикс контекста в именах файлов и компонентов. Внутри конкретного slice не дублируй его имя в каждом файле, если роль файла уже понятна.
- Page-local static UI может называться коротко: `hero.tsx`, `heading.tsx`, `cta.tsx`.
- Названия должны отражать роль в текущем slice, а не весь путь.
- Для query hooks используй форму `use-<domain-data>.ts`.
- Для query options используй `query.ts`; для типов модели — `types.ts`; для public API slice — `index.ts`.

## Metadata, Routes и SEO

- Route constants держи в `src/shared/constants/routes.ts`.
- Site-wide config и `getAbsoluteUrl` держи в `src/shared/constants/site.ts`.
- Page metadata держи рядом со страницей в `src/_pages/<page>/metadata`.
- Route files могут экспортировать metadata из `_pages`.
- `app/sitemap.ts` должен использовать `routes`, `getAbsoluteUrl` и реальные read actions/selectors, не хардкодить динамические paths.
- `app/robots.ts` использует `siteConfig.url`; при изменении домена обновляй `NEXT_PUBLIC_SITE_URL` или default в `site.ts`.

## `apps/api`

`apps/api` — минимальное NestJS приложение.

- Entry point: `src/main.ts`.
- Root module/controller/service: `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`.
- Default port: `3002`, `PORT` валидируется как integer в диапазоне `0..65535`.
- Используй стандартные NestJS modules/controllers/services/providers. Не тащи frontend/FSD-паттерны в backend.
- Для backend изменений запускай минимум `yarn workspace api check-types` и `yarn workspace api lint`; если меняется runtime/build output — `yarn workspace api build`.

## `apps/docs` и `packages/ui`

- `apps/docs` сейчас starter Next.js app на порту `3001`.
- `packages/ui` сейчас stub package с экспортом `./* -> ./src/*.tsx`.
- Основной сайт использует shadcn primitives из `apps/site/src/shared/ui`, а не `packages/ui`.
- Если меняешь `packages/ui`, учитывай потребителей `apps/docs` и `apps/site`, запускай `yarn workspace @repo/ui check-types` и при необходимости проверки потребителей.
- Если меняешь shared configs в `packages/eslint-config` или `packages/typescript-config`, запускай релевантные проверки во всех затронутых workspaces или корневые `yarn lint` / `yarn check-types`.

## Проверки

После изменений в `apps/site` запускай минимум:

```bash
yarn workspace site check-types
yarn workspace site lint
```

Если затронуты route boundaries, metadata, Next Image, app router, data builders, hydration или imports между слоями, дополнительно запускай:

```bash
yarn workspace site build
```

После изменений в `apps/api`:

```bash
yarn workspace api check-types
yarn workspace api lint
```

После изменений в `apps/docs`:

```bash
yarn workspace docs check-types
yarn workspace docs lint
```

После изменений только в документации (`*.md`) кодовые проверки обычно не нужны. Достаточно проверить diff и форматирование затронутого файла, если есть сомнения.

## Git

- Не откатывай чужие изменения.
- Перед commit проверяй `git status --short` и staged diff.
- Коммиты делай только по явному запросу пользователя.
- В грязном worktree меняй только файлы, относящиеся к задаче. Сейчас в репозитории могут быть пользовательские изменения, не связанные с твоей задачей.
