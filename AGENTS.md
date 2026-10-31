# AGENTS.md

Инструкции для AI-агентов, работающих в этом репозитории.

## Общение

- Отвечай пользователю на русском языке.
- Код, команды, пути, API-имена и сообщения ошибок оставляй на языке оригинала.
- Если пользователь явно попросил другой язык, следуй запросу.

## Цель продукта и приоритет CTA

- Главная цель сайта Artmate — продажа товаров, прежде всего альбомов с раскрасками.
  Любую задачу — дизайн, тексты, пользовательский сценарий или техническое изменение —
  оценивай по тому, как она помогает выбрать товар и дойти до покупки.
- Основной CTA должен вести к следующему шагу покупки, подходящему текущей странице:
  выбору товара, странице конкретного альбома, добавлению в корзину или оформлению заказа.
  Остальные действия оформляй как вторичные, чтобы они не конкурировали с главным CTA.
- В просмотре работы из галереи, включая модалку и мобильный шит, главный CTA —
  «Посмотреть альбом» со ссылкой на альбом этой работы. Страница работы, переход к автору,
  лайки и возможность поделиться — вторичные действия.
- Перед завершением задачи проверь, понятен ли покупателю следующий шаг к товару,
  заметен ли основной CTA и ведёт ли он к нужному альбому или этапу покупки.

## Тексты интерфейса

- Пиши для человека, который пользуется сайтом, а не для разработчика: коротко,
  естественно и по делу. Это относится к кнопкам, ссылкам, формам, подсказкам,
  уведомлениям, ошибкам и пустым состояниям во всех приложениях.
- Не используй канцелярит, шаблонные рекламные фразы и «ИИ-текст»: абстрактные
  обещания, натянутые метафоры, лишние пояснения очевидного. Называй конкретное
  действие или результат. Не добавляй текст только для заполнения блока.
- Не показывай внутренние статусы, названия технологий, форматы файлов и другие
  технические подробности, если они не нужны для действия пользователя. Например,
  ссылка в согласии — «правила клуба Artmate», не «правила клуба Artmate (DOCX)».
  Формат/размер указывай там, где это действительно помогает выбрать или загрузить
  файл, а не автоматически у каждой ссылки.
- Ошибка должна понятно объяснять, что произошло и что можно сделать дальше,
  без сырого ответа API и без обвинения пользователя. Не обещай сохранность данных
  или успех действия, если это не подтверждено.
- В согласиях называй конкретный документ и давай прямую ссылку. Не пиши
  «правила, изложенные выше», если выше лишь краткое описание. Простота текста
  не должна скрывать существенные условия или подменять юридический документ.
- Перед завершением прочитай изменённые тексты глазами покупателя и проверь их
  в контексте интерфейса: понятны ли действие, смысл и следующий шаг без знания
  устройства проекта. Используй принятые в продукте формулировки и обозначения.

## Правовые документы на сайте

- Все новые и обновляемые правовые документы подключай по образцу публичной
  оферты: отдельная публичная страница `/legal/...`, общий `LegalPage` и встроенный
  `PdfDocumentViewer`. Пользователь сначала читает документ на сайте; скачивание
  доступно как отдельное действие, а не вместо просмотра.
- Файл последней согласованной редакции размещай в PDF в
  `apps/site/public/documents/legal`, его название, дату и путь регистрируй в
  `apps/site/src/_pages/legal/source-documents.ts`. DOCX — исходник для подготовки,
  не целевой адрес пользовательских ссылок. При конвертации сохраняй полный текст
  и проверяй читаемость всех страниц; не подменяй документ устаревшим PDF.
- Ссылки из согласий, форм и навигации ведут на страницу документа через
  `routes.legal`, а не напрямую на скачивание. Если согласие открывает документ
  в новой вкладке, состояние формы должно сохраняться. Ссылку называй человеческим
  названием документа, без расширения файла.
- Переиспользуй существующий просмотрщик, не создавай отдельный iframe или
  дублирующую HTML-версию. Проверяй загрузку PDF, просмотр на мобильном и десктопе,
  актуальность редакции и соответствие ссылки документу до публикации.

## Репозиторий

Монорепозиторий на Yarn Classic workspaces + Turborepo.

- Node: ориентируйся на `.nvmrc` (`22.13`), при этом `package.json` допускает `>=18`.
- Package manager: `yarn@1.22.22`. Не добавляй lock-файлы других менеджеров.
- Registry для зависимостей: только `https://registry.npmjs.org/`. Не оставляй `sravni` / Artifactory URL в `yarn.lock`; если они появились в `resolved`, замени их на npm registry URL.
- `README.md` пока в основном starter-шаблон Turborepo, не используй его как единственный источник правды.

Workspaces:

- `apps/studio` - отдельная студия генератора; API только `/api/studio`, порт 3005.
- `apps/site` - основной Next.js сайт Artmate.
- `apps/admin` - административная панель Artmate.
- `apps/affiliate` - кабинет партнёров Artmate.
- `apps/api` - backend на NestJS.
- `services/coloring` - отдельный Python-генератор раскрасок; не Yarn workspace.
  Не связывать его с существующим модулем раскрасок, каталогами и БД Artmate.
  Правила и проверки: `services/coloring/AGENTS.md`.
- `packages/ui` - stub React UI package для shared workspace-компонентов.
- `packages/eslint-config`, `packages/typescript-config` - общие конфиги.

Проект находится в активной разработке. Когда пользователь явно заменяет route,
API-контракт, UI-сценарий или реализацию новым вариантом, удаляй прежний вариант,
legacy redirects, aliases, compatibility fallbacks и тесты старого поведения. Не
сохраняй обратную совместимость без отдельного запроса пользователя или явно
подтверждённой production-необходимости.

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

Основные workspaces: `site`, `admin`, `affiliate`, `api`, `@repo/ui`. Основные scripts: `dev`, `lint`, `check-types`, `build`; у `@repo/ui` сейчас нужны в основном `lint` и `check-types`.

Порты по умолчанию:

- `site` - `3000`.
- `api` - `3002`, можно переопределить через `PORT`.
- `admin` - `3003`.
- `studio` - `3005`, отдельный Python API - `8000`.
- `affiliate` - `3006`.

Если запускаешь dev-серверы для проверки задачи, после проверки останавливай все процессы, которые сам поднял, и проверяй порт:

```bash
lsof -iTCP:<port> -sTCP:LISTEN -n -P
```

Коммиты должны быть Conventional Commits. Husky запускает `yarn commitlint --edit "$1"`.

## Production VPS

Контекст production-сервера Artmate для будущих задач:

- Host: `186.246.8.79`.
- SSH user: `root`.
- SSH key: `/Users/denis.voropayev/.ssh/artmate-github-actions-deploy`.
- Project directory: `/opt/artmate`.
- Compose command:

```bash
docker compose --env-file .env --env-file .image.env -f docker-compose.prod.yml
```

Подключение с локальной машины:

```bash
ssh -i /Users/denis.voropayev/.ssh/artmate-github-actions-deploy -o IdentitiesOnly=yes root@186.246.8.79
```

Для SSH-команд на VPS всегда запрашивай разрешение пользователя. Не записывай в `AGENTS.md` значения production-секретов, токены, пароли или содержимое `.env`.

## Production Environment

Production-переменные приходят из GitHub Actions/Environment, а не задаются вручную в контейнере. Если добавляешь новую переменную окружения для production runtime или build, обязательно проверь и обнови весь путь доставки:

- `.github/workflows/deploy.yml` - переменная должна браться из `secrets.*` или `vars.*` и попадать в генерируемый `/opt/artmate/.env`.
- `docker-compose.prod.yml` - переменная должна быть передана в нужный service через `environment`.
- `infra/env.prod.example` и корневой `.env.example` - добавь пример значения без секретов.
- `infra/required-prod-env.txt` - добавь переменную, если production без неё не должен запускаться.
- `turbo.json` `globalEnv` - добавь переменную, если она используется в коде, build, lint или typecheck.

После изменения production env проверяй минимум:

```bash
bash infra/validate-prod-env.sh --env-file infra/env.prod.example
docker compose --env-file infra/env.prod.example -f docker-compose.prod.yml config --quiet
```

Если `infra/env.prod.example` не содержит другие уже обязательные значения, допускается подставить для проверки временные значения через `env ...`, не записывая реальные секреты в репозиторий.

## Payment Providers

- T-Bank Internet Acquiring API: `https://developer.tbank.ru/eacq/api`

## Frontend

Frontend workspaces: `apps/site`, `apps/admin`, `apps/affiliate`, `apps/studio`. Все frontend-приложения используют одинаковый базовый стек и FSD-подобную архитектуру.

Стек:

- Next.js 16, App Router, React 19, TypeScript.
- Tailwind CSS v4 через `app/globals.css`.
- shadcn/ui (`radix-nova`), `radix-ui` primitives, `lucide-react`.
- TanStack Query для client/server data cache и mutations.
- React Hook Form для форм. Не добавляй новые формы на raw `FormData`, `useActionState` или ручном `useState`-парсинге без сильной причины.
- `zod` используй для схем форм, `@hookform/resolvers` - для подключения этих схем к React Hook Form.

### Аналитика сайта

Перед изменением Яндекс Метрики, ecommerce, целей, page views или feature analytics обязательно прочитай [`apps/site/src/shared/lib/analytics/AGENTS.md`](apps/site/src/shared/lib/analytics/AGENTS.md). Аналитика использует shared typed transport и feature-local adapters; прямые вызовы `window.dataLayer`/`window.ym` из UI и business hooks запрещены.

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
src/_pages/      сборка страницы из features/widgets/page-local static UI
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
  ui/
    hero.tsx
    section.tsx
```

Правила:

- Page slice только собирает route-level experience из features, widgets и page-local static UI.
- Page slice не хранит и не экспортирует Next.js `metadata`; route-level metadata объявляй в `app/**/page.tsx`.
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

- Адаптивные модальные сценарии: при ширине viewport от `768px` открывай модалку
  (`Dialog`), при ширине `767px` и меньше всегда открывай нижний шит (`Drawer`).
  Это общее правило для сайта, включая просмотр изображений, формы и другие
  модальные сценарии. Содержимое и действия должны быть одинаковыми в обоих вариантах.
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
- SEO registry, keyword groups, metadata factories и JSON-LD держи в `src/shared/lib/seo`.
- Route files (`app/**/page.tsx`) должны объявлять статическую `metadata` или `generateMetadata(...)` сами, вызывая helpers из `src/shared/lib/seo`.
- Не создавай `src/_pages/<page>/metadata` и не экспортируй `metadata` из page slices.
- `app/sitemap.ts` должен использовать `routes`, `getAbsoluteUrl` и реальные server read actions/selectors, не хардкодить динамические paths.
- `app/robots.ts` использует `siteConfig.url`; при изменении домена обновляй `NEXT_PUBLIC_SITE_URL` или default в `site.ts`.

## Backend

`apps/api` - минимальное NestJS приложение.

- Entry point: `src/main.ts`.
- Root module/controller/service: `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`.
- Default port: `3002`, `PORT` валидируется как integer в диапазоне `0..65535`.
- Официальный OpenAPI JSON CDEK API v2: `https://gateway.cdek.ru/api-cdek-docs/web/docs/merged?sectionId=api_v2_integration`.
- Используй стандартные NestJS modules/controllers/services/providers. Не тащи frontend/FSD-паттерны в backend.
- Для backend изменений запускай минимум `yarn workspace api check-types` и `yarn workspace api lint`; если меняется runtime/build output - `yarn workspace api build`.

### Границы доменов и взаимодействие сервисов

Эти правила применяются к доменным модулям текущего backend и к отдельно развёрнутым микросервисам. Они задают целевую архитектуру, а не утверждают, что существующие интеграции уже полностью ей соответствуют.

- Каждый доменный сервис владеет своими бизнес-правилами, состоянием и переходами этого состояния. Он не реализует правила другого домена и не изменяет его данные напрямую.
- Доменная логика не зависит от внешних поставщиков, их API, SDK, форматов уведомлений, кодов статусов или способов получения данных. Внешние контракты известны только соответствующим интеграционным адаптерам. Адаптер проверяет внешние данные и переводит их во внутренний контракт своего домена; сырой ответ провайдера не становится межсервисным контрактом.
- Междоменное взаимодействие осуществляется через явно определённые внутренние контракты, сохранённые в БД: опубликованные состояния/read-модели, команды и события. Общая БД не означает совместного владения всеми таблицами: потребитель читает только опубликованный контракт, а изменение состояния выполняет сервис-владелец. Команды помещаются в предназначенный для них канал в БД, а не реализуются прямым обновлением чужих таблиц. Прямой вызов бизнес-сервиса другого домена не заменяет этот контракт.
- Потоки бизнес-фактов должны быть однонаправленными: внешний источник → адаптер домена-владельца → подтверждённое состояние и событие в БД → потребители. Если сервису нужна информация другого домена, он читает опубликованный контракт в БД, а не запускает цепочку встречных вызовов и повторных проверок. Потребитель не просит источник заново подтвердить уже сохранённый факт.
- Источник истины о факте оплаты — банк/эквайер. Основной поток: банк присылает webhook → платёжный адаптер проверяет подлинность, идентификаторы, сумму и статус → платёжный домен сохраняет подтверждённую оплату и событие в БД → лояльность читает БД и списывает ранее зарезервированные баллы. Если контракт банка требует сверки статуса после webhook, её автоматически выполняет только платёжный адаптер. Лояльность не обрабатывает банковские webhook и не знает о банках, их статусах или API. Для внутренних потребителей сохранённый подтверждённый статус в БД — единственный источник сведений об оплате.
- Не подтверждай оплату по возврату пользователя на success-страницу, нажатию кнопки, статусу CRM, таймеру или решению администратора. При потерянном webhook/сетевой ошибке допустима автоматическая сверка исходной операции платёжным адаптером; результат проходит тот же путь через БД. Это восстановление доставки факта банка, а не второй независимый источник истины. Отсутствие подтверждения не доказывает окончательную отмену платежа.
- Минимизируй ручное управление. Штатные оплата, списание/освобождение бонусов и повторы после временных сбоев выполняются автоматически по подтверждённым данным. Не добавляй кнопки ручного подтверждения оплаты, проверки/повтора, обходы состояний и обязательные действия оператора без отдельного согласования. Диагностика исключительных сбоев остаётся технической, а не дополнительным пользовательским или административным сценарием. Это не отменяет отдельно согласованные административные операции, например отмену заказа или учёт уже выполненного возврата.
- Независимость сервисов и разделение ответственности не означают требования сделать каждую функцию идемпотентной. Защита от повторной обработки обязательна там, где повторы возможны и создают нежелательный бизнес-эффект: платёжные уведомления, начисление/списание/возврат бонусов, обработка команд и событий из БД, повторяемые фоновые задания с изменением состояния. Повторная или конкурентная обработка одной такой операции не должна дублировать результат. Используй стабильные идентификаторы операций, уникальные ограничения БД, транзакции и проверку допустимых переходов. Одинаковый ключ с другим содержимым — конфликт, а не новая операция. Устаревшее событие не должно откатывать актуальное состояние. Не добавляй журналы дедупликации и ключи операций в каждую функцию без конкретного риска повторного эффекта.
- Изменение состояния и публикация связанного события фиксируются одной локальной транзакцией в БД (`transactional outbox`). Потребитель атомарно сохраняет результат и факт обработки (`inbox` или эквивалентная запись с уникальным ключом). Доставка допускает повторы; незавершённые операции восстанавливаются повторной обработкой и сверкой с БД. Не полагайся на память процесса или недолговечные callbacks как на единственный механизм доставки.
- Ошибка потребителя не должна отменять уже подтверждённый факт в домене-источнике. Например, сбой лояльности не превращает подтверждённую оплату в неоплаченную: факт оплаты сохраняется, а обработка лояльности повторяется. Противоречивые факты фиксируются для сверки, без молчаливого изменения баланса или потери события.
- Внешние побочные эффекты также должны быть защищены от повторов: используй идемпотентный ключ поставщика, если он поддерживается, и сохранённое состояние операции. После неопределённого результата сначала сверяй исходную операцию; не повторяй безусловно внешний запрос, способный повторно списать деньги или создать другой необратимый эффект.

## Packages

- `packages/ui` сейчас stub package с экспортом `./* -> ./src/*.tsx`.
- `apps/site` и `apps/admin` используют shadcn primitives из своего `src/shared/ui`, а не `packages/ui`.
- Если меняешь `packages/ui`, учитывай потребителей `apps/site` и `apps/admin`, запускай `yarn workspace @repo/ui check-types` и при необходимости проверки потребителей.
- Если меняешь shared configs в `packages/eslint-config` или `packages/typescript-config`, запускай релевантные проверки во всех затронутых workspaces или корневые `yarn lint` / `yarn check-types`.

## Проверки

После больших фич во frontend-проектах обязательно делай отдельную архитектурную сверку перед финальным ответом или коммитом:

- проверь, что `app/`, `_pages`, `features`, `entities`, `widgets`, `shared` соблюдают свои границы ответственности;
- проверь data flow для query/server actions/hydration и отсутствие сценарной логики в `_pages` или `shared/actions`;
- проверь, что формы используют `react-hook-form` + `zod`, а DTO/value mappers лежат в `features/<feature>/lib`;
- проверь public API slice (`index.ts`) и импорты между слоями, особенно после добавления новых routes/features/entities.

Минимальные проверки после изменений:

| Изменения      | Минимум                                                                | Дополнительно                                                                                                                        |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/site`    | `yarn workspace site check-types` + `yarn workspace site lint`         | `yarn workspace site build`, если затронуты route boundaries, metadata, Next Image, app router, data builders или hydration          |
| `apps/admin`   | `yarn workspace admin check-types` + `yarn workspace admin lint`       | `yarn workspace admin build`, если затронуты route boundaries, auth redirects, Next Image, app router, query providers или hydration |
| `apps/api`     | `yarn workspace api check-types` + `yarn workspace api lint`           | `yarn workspace api build`, если меняется runtime/build output                                                                       |
| `packages/ui`  | `yarn workspace @repo/ui check-types` + `yarn workspace @repo/ui lint` | проверки потребителей, если меняется публичный UI API                                                                                |
| shared configs | релевантные workspace checks                                           | корневые `yarn lint` / `yarn check-types`, если затронуто много workspaces                                                           |

После изменений только в документации (`*.md`) кодовые проверки обычно не нужны. Достаточно проверить diff и форматирование затронутого файла, если есть сомнения.

## Git

- Не откатывай чужие изменения.
- Перед commit проверяй `git status --short` и staged diff.
- Коммиты делай только по явному запросу пользователя.
- В грязном worktree меняй только файлы, относящиеся к задаче.
