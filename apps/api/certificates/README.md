# T-Bank TLS certificates

Публичные сертификаты доверия для server-to-server запросов API к T-Bank.

- Источник: <https://www.gosuslugi.ru/crt>
- Инструкция T-Bank: <https://developer.tbank.ru/eacq/intro/certificates/migration-russian-trusted-ca>
- Дата получения: 2026-08-19

В образ включена только актуальная RSA-цепочка, которую production-домен
`securepay.tinkoff.ru` отдавал на дату проверки:

- `russian-trusted-root-ca.crt` — `Russian Trusted Root CA`, SHA-256 fingerprint
  `D2:6D:2D:02:31:B7:C3:9F:92:CC:73:85:12:BA:54:10:35:19:E4:40:5D:68:B5:BD:70:3E:97:88:CA:8E:CF:31`,
  действует до 2032-02-27 21:04:15 UTC;
- `russian-trusted-sub-ca-2024.crt` — `Russian Trusted Sub CA`, SHA-256 fingerprint
  `21:55:78:50:36:C9:00:DB:B5:F1:BB:2A:15:69:C8:0C:55:59:5B:D6:BF:94:86:7A:29:BB:DD:BC:7D:88:A3:F2`,
  действует до 2029-07-19 12:50:41 UTC.

GOST-сертификаты и предыдущий RSA Sub CA 2022 года намеренно не добавлены: они
не входят в фактическую TLS-цепочку интернет-эквайринга. Перед заменой файлов
нужно повторно проверить источник, fingerprints, сроки и TLS из финального
API-контейнера.

Во время сборки `apps/api/Dockerfile` проверяет `SHA256SUMS` и подпись Sub CA
корневым сертификатом. После проверки оба сертификата добавляются в системный
trust store Debian через `update-ca-certificates`, а Node.js получает итоговый
bundle через `NODE_EXTRA_CA_CERTS`.

После сборки образа TLS нужно проверять внутри финального API-контейнера с
`rejectUnauthorized: true`. Не используйте `NODE_TLS_REJECT_UNAUTHORIZED=0` и
не вызывайте платёжный метод `/v2/Init` для такой проверки.
