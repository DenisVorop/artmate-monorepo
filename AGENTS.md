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

- `apps/site` - основной Next.js сайт Artmate.
- `apps/admin` - административная панель Artmate.
- `apps/api` - backend на NestJS.
- `packages/ui` - stub React UI package для shared workspace-компонентов.
- `packages/eslint-config`, `packages/typescript-config` - общие конфиги.

Основные команды из корня:

```bash
yarn dev
yarn build
yarn lint
yarn check-types
yarn format
```

`yarn format` пишет изменения во все `**/*.{ts,tsx,md}`, поэтому не запускай его без необходимости, если задача точечная.

Workspace-команды запускай из корня по шаблону:

```bash
yarn workspace <workspace> <script>
```

Основные workspaces: `site`, `admin`, `api`, `@repo/ui`. Основные scripts: `dev`, `lint`, `check-types`, `build`; у `@repo/ui` сейчас нужны в основном `lint` и `check-types`.

Порты по умолчанию:

- `site` - `3000`.
- `api` - `3002`, можно переопределить через `PORT`.
- `admin` - `3003`.

Если запускаешь dev-серверы для проверки задачи, после проверки останавливай все процессы, которые сам поднял, и проверяй порт:

```bash
lsof -iTCP:<port> -sTCP:LISTEN -n -P
```

Коммиты должны быть Conventional Commits. Husky запускает `yarn commitlint --edit "$1"`.

## Frontend

Frontend workspaces: `apps/site`, `apps/admin`. Все frontend-приложения используют одинаковый базовый стек и FSD-подобную архитектуру.

Стек:

- Next.js 16, App Router, React 19, TypeScript.
- Tailwind CSS v4 через `app/globals.css`.
- shadcn/ui (`radix-nova`), `radix-ui` primitives, `lucide-react`.
- TanStack Query для client/server data cache и mutations.
- React Hook Form для форм. Не добавляй новые формы на raw `FormData`, `useActionState` или ручном `useState`-парсинге без сильной причины.
- `zod` используй для схем форм, `@hookform/resolvers` - для подключения этих схем к React Hook Form.

Алиасы frontend-приложений:

```text
@/app/*       -> src/_app/*
@/pages/*     -> src/_pages/*
@/features/*  -> src/features/*
@/entities/*  -> src/entities/*
@/widgets/*   -> src/widgets/*
@/shared/*    -> src/shared/*
```

Импорты между слоями идут только вниз. Внешние импорты slice делай через public API (`index.ts`), если он есть. Внутри одного feature/entity/ui-слайса sibling UI-компоненты могут импортировать друг друга напрямую относительными путями.

Слои:

```text
app/             route binding: metadata, generateStaticParams, generateMetadata,
                 data builder, HydrationBoundary, notFound
src/_app/        root layouts, providers, data builders, app-level types
src/_pages/      сборка страницы из features/widgets/page-local static UI, metadata
src/features/    сценарии, query/mutation orchestration, client state, формы,
                 фильтры, provider/context, loading/error/empty states сценария
src/entities/    доменные read-модели, query options/hooks, selectors, read-only UI
src/widgets/     переиспользуемые крупные layout-блоки
src/shared/      ui primitives, constants, lib, server actions
```

Запрещено:

- `app/` не содержит page UI и бизнес-сценарии.
- `src/_pages/` не читает hydrated entity query, не вызывает query/mutation hooks, не показывает query-driven `DataState` и не оркестрирует сценарии. Страница только собирает features, widgets и page-local static UI.
- `src/entities/` не координирует пользовательские сценарии.
- `src/shared/` не импортирует `_pages`, `features`, `entities` или `widgets`.

## Data Flow И Формы

`shared/actions` - только слой запросов на сервер: server actions/API proxy. Здесь не должно быть UI orchestration, toast state, success/error UI contracts, feature-specific form logic и сценарных `revalidatePath(...)`.

Базовый read data flow для hydrated frontend данных:

```text
src/shared/actions/<domain>/*.actions.ts
  -> src/entities/<domain>/model/query.ts
  -> src/entities/<domain>/model/use-*.ts
  -> src/_app/lib/*-data-builder.ts       optional SSR/RSC prefetch
  -> app/**/page.tsx + HydrationBoundary
  -> src/_pages/**                        только сборка страницы
  -> src/features/**                      чтение query hook и UI состояния данных
```

Правила:

- Entity `model/query.ts` экспортирует `queryOptions(...)` со стабильным `queryKey`, обычно `staleTime: Infinity` и `retryOnMount: false` для статичных read/server данных.
- Entity hook (`use-*.ts`) должен быть отдельным `"use client"` файлом и оборачивать `useQuery(...)`.
- Entity hook возвращает только нужные потребителям поля (`data`, `isError`, `isPending` и т.п.), а не весь объект `useQuery(...)` без необходимости.
- Для SSR/RSC prefetch используй data builders из `src/_app/lib`. Они кладут данные в `QueryClient` через `setApiResultQueryData(...)` или `prefetchQuery(...)`.
- В route-файлах обезвоживай query client только через `dehydrateQueryClient(queryClient)`, потому что он сохраняет и error-состояния.
- Для динамических страниц проверяй данные после build/prefetch и вызывай `notFound()` в route, если route params невалидны.
- `QueryStateProvider` в `shared/lib/query-state-manager` уже подключен в `AppProviders`; используй его для URL search params только когда состояние действительно должно жить в URL.
- Feature mutations оформляй как hooks в `features/<feature>/model/use-<action>.ts`. UI не должен напрямую импортировать mutation actions из `shared/actions`.
- Формы пиши через `react-hook-form`. Сборку DTO/payload выноси в `features/<feature>/lib`, mutation hook - в `features/<feature>/model`, UI - за разметку, регистрацию полей и отображение ошибок.

## `model` И `lib`

- В feature `model` держи только data/query/mutation слой сценария: query options, mutations, contracts, запросы к backend/DB.
- UI-state, client-side фильтрацию/сортировку, форматтеры, URL helpers и provider logic держи в `lib`.
- Для UI-state используй `lib/<domain>-state.ts`.
- Pure form value mappers/builders (`FormValues -> DTO`, validation helpers) держи в `features/<feature>/lib`.

Если feature нужен provider, структура обязательна:

```text
src/features/<feature>/lib/<feature>-provider/
  <feature>.context.tsx
  <feature>-provider.tsx
  use-<feature>.ts
  with-<feature>.tsx
  index.ts
```

Provider подключай только через HOC:

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

### Entity

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

- `model/types.ts` описывает доменную read model или переэкспортирует generated/API types, если они являются source of truth.
- `model/query.ts` содержит query options и query keys, но не client UI-state.
- `model/use-*.ts` содержит client query hooks и всегда помечается `"use client"`.
- `lib/*-selectors.ts` содержит чистые selectors и derived read helpers.
- `ui/*` содержит read-only отображение entity. Допустим локальный UI-state для презентации, но не orchestration пользовательского сценария.
- Entity UI может принимать action callbacks вроде `onAddToCart`, `onSave`, `onDelete`, если это простой публичный контракт отображения. Сценарная логика, mutations и orchestration остаются в feature; slots/render props используй только когда они реально упрощают композицию.
- `index.ts` экспортирует только внешний контракт slice.

### Feature

Рекомендуемая форма:

```text
src/features/<feature>/
  index.ts
  model/
    query.ts
    use-<action>.ts
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
- Feature сама читает нужные данные через entity/query hooks и сама показывает loading/error/empty states сценария.
- `ui/<feature>.tsx` собирает feature из sibling UI-компонентов и подключает provider/HOC, если он нужен.
- Каждую feature mutation выноси в отдельный файл с именем hook/action, например `use-update-cart-item-quantity.ts`. Не собирай несколько разных mutation hooks в общий `mutation.ts`.
- Feature mutation hook не должен возвращать весь объект `useMutation(...)` без необходимости. Возвращай только нужные поля, обычно `{ mutate, isPending }`.
- Feature mutation hook может принимать callbacks вроде `{ onSuccess, onError }` и прокидывать их в `useMutation(...)`, если потребителю нужна нетривиальная реакция. Простые локальные эффекты сценария, например toast, можно держать прямо в `onSuccess` / `onError` внутри mutation hook.
- Если в компоненте используется несколько mutation hooks одновременно, одинаковые имена (`mutate`, `isPending`) переименовывай при деструктуризации в компоненте.
- Не выделяй мелкие одноразовые helper-функции вокруг mutation/query cache updates. Выноси helper только если он переиспользуется или содержит нетривиальную логику.
- Feature может передавать entity UI display/optimization props, но entity UI не должна знать, из какой feature она вызвана.

### Page

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

- Page slice только собирает route-level experience из features, widgets и page-local static UI.
- Не размещай в `_pages` query/mutation hooks, бизнес-сценарии, фильтрацию, form mutations, provider orchestration и query-driven `DataState`.
- Не прокидывай через `_pages` данные, которые feature может получить сама через entity/query hook.
- Не прокидывай callbacks сценария через page, если action принадлежит feature.
- Props page -> feature оставляй только для настоящей конфигурации страницы: `initialCategoryId`, `className`, slots/render props, статичные route-level параметры.
- Если feature используется в разных местах и должна оставаться prop-driven, разделяй `<Feature>` - контейнер с query/mutation orchestration, и `Base<Feature>` - чистый UI по props для внутреннего переиспользования.

### Page-Local Static UI

Если блок страницы является статичной версткой или маркетинговой секцией, привязанной к одной странице, держи его в `src/_pages/<page>/ui`.

- Не выноси page-local static blocks в `features`, `entities`, `shared/actions` или `widgets`.
- Не создавай `entity query`, `useQuery`, `DataBuilder`, `shared/actions` и `ApiResult` для данных, которые являются локальными константами одной страницы.
- Константы и типы для такого блока держи рядом с блоком: `src/_pages/<page>/ui/<block>/constants.ts`, либо прямо в компоненте, если данных мало.
- Если статичные данные раньше лежали в `shared/actions`, но больше не являются серверным запросом, удаляй мертвый action/query/entity слой.

### Widgets И Shared

- `widgets` используй только для обособленных крупных layout-блоков, которые реально переиспользуются на разных страницах: header, footer, global nav и похожие элементы.
- Не переноси page-local секции в `widgets` только ради уменьшения файла страницы.
- `shared/ui` - shadcn primitives и общие dumb-компоненты без доменной логики.
- `shared/lib` - инфраструктурные helpers, query client, hydration, event/query-state managers, API result wrappers.
- `shared/constants` - маршруты, внешние ссылки и site config.
- `shared/actions` - только server actions/API proxy.

## UI И Styling

- Максимально используй существующие shadcn/ui компоненты из `@/shared/ui`.
- Если нужен новый shadcn primitive, добавляй через `npx shadcn add <component>` из конкретного frontend app, где он нужен.
- `components.json` в frontend apps настроен на `style: "radix-nova"`, `rsc: false`, `iconLibrary: "lucide"`, aliases в `@/shared`.
- Не пиши самодельные inputs/dropdowns/cards/buttons, если есть shadcn/ui аналог.
- Используй `cn` из `@/shared/lib` или `@/shared/lib/utils`.
- Для статусов загрузки/ошибки/пустых данных используй общий `DataState`, если он подходит и находится внутри feature.
- Иконки бери из `lucide-react`, если подходящая иконка уже есть.
- Не создавай папку с `index.tsx`, если внутри фактически один компонент. Предпочитай `component-name.tsx`.
- Tailwind v4 подключен через `app/globals.css`, без отдельного `tailwind.config`.
- Глобальные design tokens и utilities держи в `app/globals.css` только если они действительно общие.
- SVG в `apps/site` настроены через SVGR: обычный import дает React-компонент, import с `?url` используй для URL-файла. В других frontend apps сначала проверь `next.config.js`.
- Для remote images обновляй `images.remotePatterns` в `next.config.js` того app, где используется `next/image`.

## Naming

- Не добавляй лишний префикс контекста в именах файлов и компонентов. Внутри конкретного slice не дублируй его имя в каждом файле, если роль файла уже понятна.
- Page-local static UI может называться коротко: `hero.tsx`, `heading.tsx`, `cta.tsx`.
- Названия должны отражать роль в текущем slice, а не весь путь.
- Константы именуй в `camelCase`, не используй `SCREAMING_SNAKE_CASE`.
- Для query hooks используй форму `use-<domain-data>.ts`.
- Для query options используй `query.ts`; для типов модели - `types.ts`; для public API slice - `index.ts`.

## Metadata, Routes И SEO

- Route constants держи в `src/shared/constants/routes.ts`.
- Site-wide config и `getAbsoluteUrl` держи в `src/shared/constants/site.ts`.
- Page metadata держи рядом со страницей в `src/_pages/<page>/metadata`.
- Route files могут экспортировать metadata из `_pages`.
- `app/sitemap.ts` должен использовать `routes`, `getAbsoluteUrl` и реальные server read actions/selectors, не хардкодить динамические paths.
- `app/robots.ts` использует `siteConfig.url`; при изменении домена обновляй `NEXT_PUBLIC_SITE_URL` или default в `site.ts`.

## Backend

`apps/api` - минимальное NestJS приложение.

- Entry point: `src/main.ts`.
- Root module/controller/service: `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`.
- Default port: `3002`, `PORT` валидируется как integer в диапазоне `0..65535`.
- Используй стандартные NestJS modules/controllers/services/providers. Не тащи frontend/FSD-паттерны в backend.
- Для backend изменений запускай минимум `yarn workspace api check-types` и `yarn workspace api lint`; если меняется runtime/build output - `yarn workspace api build`.

## Packages

- `packages/ui` сейчас stub package с экспортом `./* -> ./src/*.tsx`.
- `apps/site` и `apps/admin` используют shadcn primitives из своего `src/shared/ui`, а не `packages/ui`.
- Если меняешь `packages/ui`, учитывай потребителей `apps/site` и `apps/admin`, запускай `yarn workspace @repo/ui check-types` и при необходимости проверки потребителей.
- Если меняешь shared configs в `packages/eslint-config` или `packages/typescript-config`, запускай релевантные проверки во всех затронутых workspaces или корневые `yarn lint` / `yarn check-types`.

## Проверки

Минимальные проверки после изменений:

| Изменения | Минимум | Дополнительно |
| --- | --- | --- |
| `apps/site` | `yarn workspace site check-types` + `yarn workspace site lint` | `yarn workspace site build`, если затронуты route boundaries, metadata, Next Image, app router, data builders или hydration |
| `apps/admin` | `yarn workspace admin check-types` + `yarn workspace admin lint` | `yarn workspace admin build`, если затронуты route boundaries, auth redirects, Next Image, app router, query providers или hydration |
| `apps/api` | `yarn workspace api check-types` + `yarn workspace api lint` | `yarn workspace api build`, если меняется runtime/build output |
| `packages/ui` | `yarn workspace @repo/ui check-types` + `yarn workspace @repo/ui lint` | проверки потребителей, если меняется публичный UI API |
| shared configs | релевантные workspace checks | корневые `yarn lint` / `yarn check-types`, если затронуто много workspaces |

После изменений только в документации (`*.md`) кодовые проверки обычно не нужны. Достаточно проверить diff и форматирование затронутого файла, если есть сомнения.

## Git

- Не откатывай чужие изменения.
- Перед commit проверяй `git status --short` и staged diff.
- Коммиты делай только по явному запросу пользователя.
- В грязном worktree меняй только файлы, относящиеся к задаче.
