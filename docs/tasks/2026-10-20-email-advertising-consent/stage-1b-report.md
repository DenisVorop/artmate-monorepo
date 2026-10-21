# Отчёт этапа 1b — UI паролей и гостевой активации

Дата: 20.10.2026. Ветка `codex/email-advertising-consent`, база UI `c3e21a2f`. Этап ограничен рабочими UI-компонентами; новый auth pipeline ещё не подключён. Следующий срез — 2b, точка продолжения в [progress.md](./progress.md).

## Результат

- `AuthFlowView` получил типизированные варианты login, registration, activation, recovery, recovery-sent, activation-loading и activation-invalid. Существующие code/profile/consents/provider/success/cancelled сохранены и собраны в той же feature.
- Login — email и существующий пароль, восстановление, регистрация и компактный Яндекс. Кнопки «Войти по коду» нет; callback формы не запрашивает OTP. Старая минимальная длина пароля для создания credential не применяется к входу в существующий аккаунт.
- Email entry теперь только регистрационный: «Создать аккаунт» → «Получить код». После кода новый серверный coordinator сможет передать registration view; UI сам не определяет наличие аккаунта и не создаёт User.
- Регистрация содержит ФИО, телефон, пароль и повтор пароля. Активация после гостевой покупки — только пароль и повтор: нет code/email/contact inputs. При недостающем профиле используется отдельный существующий шаг.
- Обе формы проверяют совпадение паролей и текущий минимум 8 символов. Пустое подтверждение/несовпадение остаются на форме; ошибка привязана к полю. Пробелы в пароле сохраняются, пароль не нормализуется как email.
- Видимость каждого пароля переключает Eye/EyeOff, с доступным именем/aria-pressed и отдельным состоянием. Поля подходят password managers и вставке. При размонтировании формы пароль/видимость не сохраняются в storage или cache.
- Recovery говорит о восстановлении доступа, без предположения о существовании пароля. Есть общий экран ответа и экран недействительной activation-ссылки с действием запроса новой.
- Общие `StepForm`, поля контактов/создания пароля и provider buttons переиспользуются между шагами. На mobile порядок: поля → преимущества/ПДн → основное действие. Сохранены светлая тема, gradient CTA, официальная «Я», круглые маркеры справа и square-реклама. Палитра на mobile 48 px, desktop 64 px. Success — центрированная 3D-галочка и «Вы вошли в Artmate», без текста о подписке.

## Архитектурная сверка

| Граница     | Проверка                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FSD         | Изменения только `features/auth/lib`, `features/auth/ui/flow` и адресный test. app/\_pages/shared/entities и прочие features не менялись                     |
| Формы       | React Hook Form + zod/resolvers; сценарных запросов/ручного FormData нет                                                                                     |
| model/lib   | UI contracts/validation и локальный visibility hook в lib. Новых mutations нет; transport/model не изменены                                                  |
| Компоненты  | shadcn Input/Button/Label/Checkbox, существующий CtaGradientButton, Lucide, текущие tokens/ассеты; отдельной CSS-системы нет                                 |
| Оркестрация | View рендерит переданный step и callbacks. Не вычисляет trusted identity/готовность, не делает login/OTP/OAuth/redirect/session writes                       |
| Public API  | Существующие consumers AuthForm/PasswordResetForm работают как прежде. withAuth/useAuth и общий host не имитируются: это этап 6                              |
| Секреты     | Пароли только в памяти формы до передачи своему callback; нет localStorage/logging/analytics/query cache. PasswordConfirm не становится новым полем evidence |
| Demo        | В приложении нет preview route, панели сценариев, mock adapter, fixture code или таймеров. Временный browser probe находился только в /tmp                   |
| Backend     | API/schema/неприменённая миграция этапа 2/checkout/order-activation не изменены                                                                              |

Существующий live AuthForm не заменён неподключёнными шагами: миграция production callers идёт после server stages и общего host. Это UI-результат, а не готовая новая авторизация или сбор согласий.

## Проверки

Node `22.13.1`, Yarn `1.22.22`:

- `yarn workspace site check-types` — passed.
- `yarn workspace site lint` — passed, 0 warnings.
- `yarn workspace site test` — 436 passed, 0 failed/skipped; добавлены 3 смысловые проверки схем: сохранение existing password, confirmation/length в registration+activation, отсутствие контактных требований у activation при наличии их у signup.
- `yarn workspace site build` — passed, локальная Next.js production-сборка без публикации.
- Форматирование по site Prettier/Tailwind и `git diff --check` — passed.

Браузер проверял **настоящие React/RHF/shadcn-компоненты** с CSS, собранным из site globals и классов проекта. Внешний временный стенд адаптировал только Next Image/Link и управлял callbacks; backend/SMTP/OAuth не вызывались. Это проверка UI, не интеграционные испытания будущего server pipeline.

52 сочетания без горизонтального overflow:

- 8 форм на 320/360/390/430/1024 CSS px: login, email, code, registration, activation, recovery, consents, profile.
- 6 состояний на 320/1024: activation-loading, activation-invalid, recovery-sent, provider, success, cancelled.
- На каждой форме ровно один form, отсутствует code-login action. На переходе пароли размонтируются, heading получает фокус; на mobile обязательный checkbox до submit.
- Проверены Eye/EyeOff, password login callback без кода, mismatch и исправление регистрации, signup → code → registration, activation через Enter → consents, блокировка со снятыми ПДн, продолжение без рекламы, generic recovery и переход invalid link → recovery. Закрытие клавиатурой/повторный монтаж очищают пароль.

Материалы: [browser-checks.json](./verification/stage-1b/browser-checks.json), [desktop activation](./verification/stage-1b/activation-desktop.png), [mobile activation 320](./verification/stage-1b/activation-mobile-320.png), логи typecheck/lint/tests/build в той же папке. Временный сервер на 60316 остановлен, порт проверен; browser tab закрыта, viewport override сброшен.

## Ограничения и продолжение

Не реализованы новый server identity/credential draft/link exchange, реальное сохранение consent/evidence, привязка гостевых заказов в новом completion, HOC/hook/host и миграция callers. Пока нет новых session/подписки по нажатию этих UI callbacks. J1/J2/J3/Q2 остаются на соответствующих этапах.

Следующий этап **2b**: адаптировать prepared Auth schema/contracts под password authentication отдельно от реального email verification, activation-link proof, browser-bound draft/operation и сохранение существующего User/заказов. Успех password login не записывать как OTP и не добавлять ему код. Отчёт после 2b, без перехода к 3a автоматически. Коммит/production/рассылка в этом этапе не выполнялись.

## Уточнение центрирования

По замечанию пользователя исправлено вертикальное центрирование временной страницы просмотра: карточка была по центру горизонтально, но сверху по вертикали. Внешний контейнер теперь центрирует по обеим осям и растёт, если форма выше окна. Сам AuthFlowView не получает viewport-позиционирование. После исправления разница противоположных отступов меньше 0.5 px; [новый снимок](./verification/stage-1b/activation-desktop-centered.png), [измерение](./verification/stage-1b/centering-check.json). Исходники приложения не менялись. При подключении общего host этот layout обеспечивает внешний Dialog/page container.
