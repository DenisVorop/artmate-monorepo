# Проверка этапа7 в браузере

Финальный строгий прогон: **13/13**, `browser.log`, `route-checks.json`.

Проверялась настоящая production-сборка Next.js из рабочего worktree, реальные route-компоненты, `withAuth/useAuth`, coordinator, React Hook Form, Dialog и server actions. Вместо backend работал отдельный локальный HTTP fixture в `/tmp`; в приложении нет тестового маршрута или панели.

Внешние адреса Яндекса и аналитики перехвачены браузером до отправки и получили локальные фиктивные ответы. Реальные OAuth, SMTP, рабочая БД и production не использовались. Для проверки production-политики COOP `same-origin` из Caddy этот заголовок добавлялся к локальным document responses; остальные проверенные security headers пришли из настоящего Next proxy.

## Пройденные сценарии

1. Пароль → согласия → завершение → `/account/orders`, ширина320px.
2. Тот же сценарий,390px.
3. Тот же сценарий,1280px.
4. Готовая SESSION: переход без окна, пароля и кода.
5. SESSION без согласий: согласия, отмена сохраняет сессию.
6. Активация гостевой покупки: exchange ссылки → пароль+подтверждение → контакты → согласия → `/account`. JWT отсутствует до согласий; token удалён из URL.
7. Недействительная activation-ссылка: восстановление доступа без сессии.
8. Смена пароля: token удалён после успеха, сессия не создаётся, переход ко входу.
9. Просроченный reset-token: понятная ошибка и новая ссылка, сессии нет.
10. Восстановление доступа: нейтральный результат без раскрытия существования аккаунта, сессии нет.
11. Яндекс: настоящий переход браузера на другой origin; COOP разрывает opener, BroadcastChannel специально отключён. Callback обменивается ровно один раз; original parent продолжает через bound server polling; query очищен и остаётся чистым после RSC; popup показывает успешный результат. Чужие origin/source сообщения не авторизуют. Кода Artmate и создания локального пароля нет; контакты и согласия показаны до JWT.
12. Заблокированный popup: provider-запрос не начинается, понятная повторяемая ошибка.
13. Закрытый popup: явный возврат через «Другой способ входа», сессия не создаётся.

На320px отдельно пройдены12 Tab-переходов с удержанием фокуса в Dialog. На320/390/1280px проверены геометрия окна, отсутствие горизонтального переполнения и вложенных форм. Рекламный checkbox выключен; ПДн включён. Чувствительные маршруты имеют `no-store`, `no-referrer`, `noindex`; analytics bootstrap отсутствует даже при фиктивных включённых ID и противоположном поддельном client header.

Console/page errors:0. Неожиданных network failures:0. Отдельно сохранены19 `net::ERR_ABORTED`: отменённые Next navigation/RSC/prefetch-запросы во время router refresh и закрытия тестовых contexts. Они не скрыты и перечислены в `route-checks.json`.

## Найдено и исправлено

Cookie-driven RSC возвращал исходный URL с token/query после `history.replaceState(window.history.state, ...)`. Передача внутреннего состояния `__NA` обходила синхронизацию canonical URL в Next16. Исправление: чистый history update с `null`, захват первоначального input для текущего flow и очистка до первого server action. Финальный строгий прогон подтвердил чистые activation и callback URL; повторного callback exchange нет.

До: `activation-token-before.json`, `activation-token-before-url.txt`, `activation-token-before.png`, `activation-token-after-earlyfix-still-fails.json`, `callback-token-before.json`.
После: `activation-token-after.json`, `callback-token-after.json`, `route-checks.json`, `browser.log`.

Промежуточный `exploratory-checks.json` намеренно пропускал уже известные token assertions и не является финальным результатом.

## Ограничения

- Полный axe scan не запускался: axe-core отсутствует в установленном runtime.
- Производительность и layout shift не оценивались: локальный fake API не воспроизводит production latency.
- Проверена утверждённая светлая тема. Отдельный аудит всех hit targets, тёмной темы и локалей не входил в сценарную проверку.
- Браузер проверяет route/server-action/UI pipeline с HTTP fixture. Реальная безопасность backend и доменных транзакций проверяется отдельными native/targeted тестами этапа.

Оба поднятых QA-процесса остановлены. `lsof` подтвердил отсутствие listeners на62323,62324 и62311; детали в `cleanup.json`.
