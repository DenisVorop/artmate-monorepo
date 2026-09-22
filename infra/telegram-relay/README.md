# Telegram через SSH

Production API / tg → `http://telegram-relay:8080/telegram-api` → TLS через
SSH → Caddy финского VPS → Telegram. URL задаётся production variable
`TELEGRAM_API_BASE_URL` в GitHub; существующий relay token не меняется.

Контейнер отдельного Compose-проекта подключён к `artmate_default` без публикации
портов. Это сохраняет транспорт даже при запуске старого deploy с
`--remove-orphans`. Не выполнять `compose down` основного проекта без учёта этой
внешней сети. HTTP используется только внутри Docker; дальше TLS с проверкой
имени `77-221-158-124.sslip.io` и зашифрованный SSH.

## Однократная подготовка

- На production: системный `artmate-tunnel`, приватный ключ в
  `/etc/artmate-telegram-tunnel/id_ed25519` (0600, владелец artmate-tunnel),
  каталог 0700. Ключ генерируется на production, не помещается в Git/Actions.
- `known_hosts` в этом каталоге: сверенный ключ финского VPS. Проверка ключа
  обязательна, `StrictHostKeyChecking=yes`.
- На финском VPS: `bash provision-edge.sh '<public key>'` создаёт выделенный
  `artmate-relay`. У него только local TCP forwarding к `127.0.0.1:443`, только
  с IP production. Shell, другие порты, remote forwarding и пароль запрещены.
  Скрипт заменяет ключ только этого выделенного пользователя; для ротации сначала
  согласовать переключение. Пароль root для работающего транспорта не нужен.
- Проверить адрес Docker bridge `172.17.0.1` на production: на нём слушает SSH.
  При изменении адреса Docker bridge обновить unit и проверить host-gateway.
- Установить unit, `systemctl daemon-reload`, `systemctl enable --now
  artmate-telegram-tunnel`. Он автоматически восстанавливает оборванный SSH.
- Запустить `docker compose -f infra/telegram-relay/docker-compose.yml up -d`.
  В дальнейшем файлы и unit доставляет production workflow.

## Проверка

Из `/opt/artmate`: `docker exec -i artmate-api-1 node < infra/telegram-relay/check.cjs`.
Проверяется `getMe` обоих ботов, без сообщений. Токены/данные ботов не выводятся.
`/health` контейнера проверяет только локальный HTTP, не Telegram: сквозная
проверка — именно `check.cjs`. Доступность Telegram не гарантируется навсегда.

Проверить unit, порт 18443 (только Docker bridge), отсутствие published ports у
контейнера, HTTP 404 для любых путей вне `/telegram-api/*`. Заголовки токенов
удалены из логов Caddy. Для проверки автоперезапуска разрешается остановить
только MainPID этого unit; systemd должен восстановить туннель за несколько секунд.

## Откат

Сначала вернуть прежний `TELEGRAM_API_BASE_URL` одновременно в GitHub production
variable и `/opt/artmate/.env`, пересоздать только api/tg с теми же образами.
Прежняя строка хранится в `/etc/artmate-telegram-tunnel/previous-base-url`.
Прямой HTTPS на финский VPS на момент настройки не работал — откат конфигурации
сам по себе не восстановит отправку.
Затем остановить отдельный Compose-проект и отключить unit. Не останавливать
основной Compose-проект. Для отзыва доступа удалить ключ выделенного пользователя
на финском VPS. Существующие Amnezia, Outline и другие SSH-пользователи не меняются.

Не пересылать старые задания очереди автоматически при установке транспорта:
повторная отправка согласуется отдельно. Политика очереди (5 попыток) здесь не меняется.
