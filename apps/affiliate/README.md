# Artmate Affiliate

Кабинет партнёра Artmate на Next.js 16. Первый инкремент включает:

- вход существующим Artmate-аккаунтом через `/auth/login`;
- server-side проверку `/auth/session` и активного профиля `/affiliate/me`;
- обзор подтверждённых условий сотрудничества;
- договор, реквизиты и минимальный порог выплаты только для чтения;
- выход через `/auth/logout`.

Промокоды, продажи, финансовая аналитика и заявки на выплаты пока не реализованы. Интерфейс не показывает демонстрационные суммы или вымышленные операции.

## Локальный запуск

Из корня монорепозитория после установки общих зависимостей:

```bash
nvm use
yarn workspace affiliate dev
```

Приложение доступно на `http://localhost:3006`, production-домен — `affiliate.artmate.ru`. Локальный API по умолчанию ожидается на `http://localhost:3002`; при необходимости используется существующая переменная `API_BASE_URL`. Настройки общей auth-cookie берутся из `AUTH_COOKIE_DOMAIN`, адрес публичного сайта — из `NEXT_PUBLIC_SITE_URL`.

## Проверки

```bash
yarn workspace affiliate test
yarn workspace affiliate check-types
yarn workspace affiliate lint
yarn workspace affiliate build
```
