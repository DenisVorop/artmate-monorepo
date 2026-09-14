# Artmate Studio frontend

Самостоятельный интерфейс генератора. Не импортировать business-модули apps/site/admin/api.
Соблюдать корневые frontend-правила: Next App Router, FSD, RHF + zod, TanStack Query, shadcn.
Маршруты app и страницы \_pages только компонуют интерфейс; сценарии в features/studio,
чтение проектов в entities/project. API только /api/studio на том же origin; авторизация
студии отдельная, пароль не сохранять в localStorage. Приватные изображения показывать
через Next Image с unoptimized, чтобы запрос шёл из браузера с cookie студии.
Новые расчёты только по явной кнопке. Площадь — мм²; цвета включают белые, размер — CSS px.
Проверки из корня: yarn workspace studio check-types, yarn workspace studio lint,
yarn workspace studio build. После изменений проверить интерфейс и архитектурные границы.
