# Браузерная проверка этапа8

Финальный строгий прогон: **13/13**, `browser.log`, `summary.json`, `route-checks.json`.

Запускалась настоящая production-сборка Next.js из task worktree. Проверены реальные страницы, компоненты форм, `withAuth/useAuth`, RHF, coordinator, Dialog и server actions. Backend заменял отдельный локальный HTTP fixture; в код приложения не добавлялись тестовые маршруты, панели или mock adapters.

## Что проверено

1–3. `/contacts`,320/390/1280px: невалидная форма не открывает auth; отмена сохраняет введённые поля и тот же DOM textarea; пароль ведёт к согласиям без кода; реклама выключена, ПДн включено; до «Продолжить» business request отсутствует. После завершения выполняется ровно один authenticated POST, source=`contact_form`, исходный payload сохранён.

4. `/contacts` с готовой SESSION: business success без появления окна авторизации.

5. Ошибка business POST контактов: форма и значения сохраняются; следующий клик выполняет одну новую попытку и завершается успешно.

6–8. `/partners`,320/390/1280px: validation перед auth, отмена сохраняет форму/DOM, пароль → согласия → один authenticated business POST. Source=`partner_application`; исходные UTM сохранены даже после изменения URL во время auth.

9. Ошибка partner business POST: поля сохранены, повторная явная отправка с готовой SESSION успешна.

10. `/cart`,1280px: гостевой preview промокода требует входа, отмена сохраняет код; успешный вход выполняет новый authenticated preview исходного кода и показывает применение. Source=`cart`.

11. `/checkout`,1280px: то же поведение промокода; после входа сохранены имя, телефон, email, комментарий и тот же DOM input имени. Source=`checkout`.

12. `/checkout`,390px: вход из блока баллов открывает общий Dialog, отмена сохраняет гостевые поля и не создаёт заказ.

13. `/checkout`,390px: гостевой заказ создаётся без auth flow и access cookie и переходит на локальный payment fixture.

Во всех измеренных auth-окнах320/390/1280px отсутствуют горизонтальное переполнение и вложенные формы; Dialog расположен вне формы caller. Console/page errors:0. Неожиданных network failures:0. Ожидаемые Next navigation/RSC/prefetch cancellations `net::ERR_ABORTED` сохранены отдельно в JSON.

## Ограничения и fixtures

- Только синтетические пользователи, адреса и бизнес-данные. Внешние analytics, изображения и другие запросы перехватывались до отправки; реальные OAuth, SMTP, платежи, production и рабочая БД не использовались.
- Backend авторизация/транзакции проверяются отдельными native-тестами этапа; browser доказывает route/server-action/UI pipeline с HTTP fixture.
- Для checkout восстановлен существующий корректный ПВЗ через реальный contract localStorage, расчёт содержит корректную revision hex64. UI выбора карты/города здесь не проверялся.
- Redirect гостевой покупки обработан внешним browser fixture, без добавления product route. Платёжная интеграция не проверялась.
- Cookie consent синтетически принят в localStorage, чтобы баннер не перекрывал формы. Это отдельно от согласия на рекламу: рекламный checkbox оставался выключенным.
- Полный axe audit, другие темы/локали и web vitals/layout shift не запускались; это не аудит WCAG или производительности.
- Промежуточные падения были ошибками probe/fixture (точные DTO `sent`, readiness повторной SESSION, текст FormError, неоднозначный selector accordion, redaction поля promo code, revision расчёта). Product code ради прохождения browser probes не менялся. Финальный полный прогон строгий и успешный.

Все поднятые QA-процессы остановлены, Chrome contexts закрыты. Порты62325/62326 свободны по `lsof`; native PostgreSQL62311 не трогался. Детали в `cleanup.json`.
