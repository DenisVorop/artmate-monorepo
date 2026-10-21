# Отчёт этапа 1 — компоненты авторизации

Дата: 20.10.2026. Ветка: `codex/email-advertising-consent`. Актуальная точка продолжения и архитектурное напоминание: [progress.md](./progress.md).

## Что остаётся в приложении

- Переиспользуемый UI email/code/profile/consents/provider/success/cancelled в `features/auth/ui/flow`.
- RHF + zod schemas и presentation contracts в `features/auth/lib`; callback-driven UI без вызовов auth API.
- Нужные изображения: 3D-палитра, 3D-галочка и официальный «Я»; существующие логотип, shadcn primitives и site CTA/tokens.
- Светлая адаптивная верстка, пустая необязательная реклама, включённые управляемые ПДн, прямые legal links и корректные мобильные пробелы. На mobile обязательный checkbox до submit.

## Уточнение после отчёта

По прямому запросу пользователя демонстрационная инфраструктура удалена: панель, mock state/данные/таймеры, отдельная feature entry, page/route и 15 проверок только этого harness. Убран и параметр initialCode: OTP-поле начинается пустым. Добавления в `proxy.ts` и `routes.ts` убраны; эти файлы вернулись к исходному содержимому. Preview не сохраняется даже как development route и не заменяется другим скрытым стендом.

HTML-макеты и скриншоты остаются документацией. В исходниках приложения — только рабочие компоненты и их необходимые зависимости. Прежние 448 passing tests включали 15 удалённых harness tests и не являются числом текущего suite.

## Архитектура и проверки

UI отделён от будущего server pipeline; формы RHF/zod, состояние настоящего сценария будет в feature lib, transport/mutations — на своих слоях. `app`/`_pages` не получают тестовую orchestration. Настоящие `withAuth/useAuth`, session и backend реализуются на предусмотренных этапах; фиктивный hook не добавлен.

Проверки после очистки: typecheck, lint и production build пройдены; site suite — 433 passed, 0 failed/skipped. Отдельно проверены отсутствие preview route в manifest, demo-ссылок/fixtures в исходниках и совпадение proxy/routes с HEAD.

До очистки UI пройден в браузере по семи сценариям и 20 mobile step/width сочетаниям; screenshot/measurement evidence сохранены в [verification/stage-1](./verification/stage-1/browser-checks.json). Это историческая проверка неизменённых компонентов, а не доступная сейчас панель сайта.

API/schema, реальные авторизация/рассылка и существующие auth callers не менялись. Следующий этап — schema и persisted contracts доменов. UI закоммичен по запросу пользователя: `c3e21a2f` — `feat(auth): add reusable sign-in step UI`. Deploy не выполнялся.
