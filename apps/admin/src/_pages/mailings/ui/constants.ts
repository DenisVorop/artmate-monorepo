export type MailingChannel =
  | "email"
  | "telegramAdmin"
  | "telegramContent"
  | "telegramCustomer"
  | "telegramSupport";

export type MailingRegistryItem = {
  readonly id: string;
  readonly trigger: string;
  readonly recipients: string;
  readonly channels: readonly MailingChannel[];
  readonly destination: string;
  readonly message: string;
  readonly conditions: readonly string[];
  readonly source: string;
};

export type MailingRegistryGroup = {
  readonly title: string;
  readonly description: string;
  readonly items: readonly MailingRegistryItem[];
};

export const mailingRegistryGroups: readonly MailingRegistryGroup[] = [
  {
    title: "Заказы и доставка",
    description:
      "Клиентские и операционные уведомления, которые уходят после оформления, оплаты и логистических событий.",
    items: [
      {
        id: "order-created-admin",
        trigger: "Заказ создан в checkout",
        recipients: "Операторы Artmate",
        channels: ["telegramAdmin"],
        destination:
          "TELEGRAM_ORDERS_CHAT_ID, fallback TELEGRAM_CONTACTS_CHAT_ID",
        message:
          "Новый заказ Artmate: номер, дата, клиент, состав заказа, ПВЗ, стоимость, итог и комментарий.",
        conditions: ["После успешного создания заказа и очистки корзины."],
        source: "orders.service.ts, orders-telegram.service.ts",
      },
      {
        id: "order-created-customer-email",
        trigger: "Заказ создан в checkout",
        recipients: "Клиент",
        channels: ["email"],
        destination: "order.customer.email",
        message:
          "Заказ ожидает оплаты или принят: товары, доставка, итог, телефон и ссылка оплаты для Ozon Acquiring.",
        conditions: ["Отправляется для каждого созданного заказа."],
        source: "orders.service.ts",
      },
      {
        id: "order-created-customer-telegram",
        trigger: "Заказ создан в checkout",
        recipients: "Клиент",
        channels: ["telegramCustomer"],
        destination: "telegram_accounts.telegram_chat_id",
        message:
          "Заказ ожидает оплаты или принят: сумма, доставка, статус и кнопка оплаты или открытия Artmate.",
        conditions: ["Только если клиент привязал Telegram к аккаунту."],
        source: "orders.service.ts, orders-telegram.service.ts",
      },
      {
        id: "order-paid-admin",
        trigger: "Ozon Acquiring прислал Completed",
        recipients: "Операторы Artmate",
        channels: ["telegramAdmin"],
        destination:
          "TELEGRAM_ORDERS_CHAT_ID, fallback TELEGRAM_CONTACTS_CHAT_ID",
        message:
          "Заказ оплачен: номер, клиент, телефон, email, способ оплаты, итог и трек-номер СДЭК при наличии.",
        conditions: ["Только при первом переходе платежа в paid."],
        source: "orders.service.ts, orders-telegram.service.ts",
      },
      {
        id: "order-paid-customer-email",
        trigger: "Ozon Acquiring прислал Completed",
        recipients: "Клиент",
        channels: ["email"],
        destination: "order.customer.email",
        message:
          "Заказ оплачен: благодарность за оплату, товары, стоимость, итог и трек-номер СДЭК при наличии.",
        conditions: ["Только при первом переходе платежа в paid."],
        source: "orders.service.ts",
      },
      {
        id: "order-paid-customer-telegram",
        trigger: "Ozon Acquiring прислал Completed",
        recipients: "Клиент",
        channels: ["telegramCustomer"],
        destination: "telegram_accounts.telegram_chat_id",
        message:
          "Оплата прошла успешно: было/стало по статусу заказа и трек-номер СДЭК при наличии.",
        conditions: [
          "Только при первом переходе платежа в paid.",
          "Только если клиент привязал Telegram к аккаунту.",
        ],
        source: "orders.service.ts, orders-telegram.service.ts",
      },
      {
        id: "order-crm-status-customer",
        trigger: "Администратор изменил CRM-статус заказа",
        recipients: "Клиент",
        channels: ["email", "telegramCustomer"],
        destination: "order.customer.email; telegram_accounts.telegram_chat_id",
        message:
          "Статус заказа изменен: предыдущий статус, новый статус и короткая подсказка по следующему шагу.",
        conditions: [
          "Email отправляется при фактическом изменении статуса.",
          "Telegram отправляется только если клиент привязал Telegram к аккаунту.",
        ],
        source: "orders.service.ts, orders-telegram.service.ts",
      },
      {
        id: "cdek-order-status",
        trigger: "CDEK ORDER_STATUS webhook",
        recipients: "Операторы Artmate и клиент",
        channels: ["telegramAdmin", "email", "telegramCustomer"],
        destination:
          "TELEGRAM_ORDERS_CHAT_ID; order.customer.email; telegram_accounts.telegram_chat_id",
        message:
          "Статус доставки СДЭК. Для ACCEPTED_AT_PICK_UP_POINT и POSTOMAT_POSTED клиент получает сообщение, что заказ можно забрать, с адресом и графиком ПВЗ.",
        conditions: [
          "Отправляется только при изменении CDEK status code.",
          "Deleted webhook игнорируется.",
          "Клиентский Telegram отправляется только при привязанном Telegram.",
        ],
        source:
          "orders.service.ts, orders.storage.ts, orders-telegram.service.ts",
      },
    ],
  },
  {
    title: "Аккаунт и Telegram",
    description:
      "Сервисные сообщения для входа, восстановления доступа и привязки Telegram к личному кабинету.",
    items: [
      {
        id: "email-verification-code",
        trigger:
          "Регистрация, вход с неподтвержденным email или повторная отправка кода",
        recipients: "Пользователь",
        channels: ["email"],
        destination: "user.email",
        message:
          "Код подтверждения Artmate: 6 цифр, срок действия и предупреждение игнорировать письмо, если регистрация не ожидалась.",
        conditions: [
          "Учитываются cooldown и лимиты отправок по email и IP.",
          "Активные старые коды потребляются при успешном подтверждении.",
        ],
        source: "email-verification.service.ts",
      },
      {
        id: "password-reset",
        trigger: "Пользователь запросил восстановление пароля",
        recipients: "Пользователь",
        channels: ["email"],
        destination: "user.email",
        message:
          "Восстановление пароля Artmate: ссылка для смены пароля, срок действия и предупреждение игнорировать письмо, если запрос был не от пользователя.",
        conditions: ["Учитываются cooldown и лимиты отправок по email и IP."],
        source: "password-reset.service.ts",
      },
      {
        id: "telegram-start",
        trigger: "Пользователь открыл Telegram-бота или нажал привязку",
        recipients: "Telegram-пользователь",
        channels: ["telegramCustomer"],
        destination: "chat.id в Telegram Mini App Bot",
        message:
          "Приветственное сообщение, кнопка открытия Artmate и кнопка или клавиатура для привязки Telegram.",
        conditions: [
          "Работает в отдельном tg workspace через Telegram webhook.",
        ],
        source: "apps/tg/src/main.ts",
      },
      {
        id: "telegram-link-code",
        trigger: "Пользователь поделился Telegram-контактом",
        recipients: "Telegram-пользователь",
        channels: ["telegramCustomer"],
        destination: "chat.id в Telegram Mini App Bot",
        message:
          "Код привязки Artmate и кнопка открытия личного кабинета. Код действует 10 минут.",
        conditions: [
          "Контакт должен принадлежать тому же Telegram-пользователю.",
          "Не отправляется, если Telegram уже привязан к аккаунту.",
        ],
        source: "apps/tg/src/main.ts, telegram-link.service.ts",
      },
      {
        id: "telegram-linked",
        trigger:
          "Пользователь подтвердил код привязки Telegram в личном кабинете",
        recipients: "Telegram-пользователь",
        channels: ["telegramCustomer"],
        destination: "telegram_accounts.telegram_chat_id",
        message: "Готово, Telegram подключен к аккаунту Artmate.",
        conditions: ["После успешной привязки Telegram к пользователю."],
        source: "telegram-link.service.ts",
      },
      {
        id: "telegram-unlinked",
        trigger: "Пользователь отключил Telegram в личном кабинете",
        recipients: "Telegram-пользователь",
        channels: ["telegramCustomer"],
        destination: "telegram_accounts.telegram_chat_id",
        message:
          "Telegram отключен от аккаунта Artmate. Его можно подключить заново в личном кабинете.",
        conditions: ["После успешного удаления привязки."],
        source: "telegram-link.service.ts",
      },
    ],
  },
  {
    title: "Обращения и контент",
    description:
      "Внутренние Telegram-уведомления для поддержки и согласования AI-черновиков блога.",
    items: [
      {
        id: "contact-form",
        trigger: "Пользователь отправил форму контактов на сайте",
        recipients: "Команда поддержки",
        channels: ["telegramSupport"],
        destination: "TELEGRAM_CONTACTS_CHAT_ID",
        message:
          "Новое сообщение с сайта Artmate: имя, email, тема, номер заказа, согласие на ПДн и текст обращения.",
        conditions: [
          "Если Telegram API вернул ошибку, форма считается неотправленной.",
        ],
        source: "contacts.service.ts",
      },
      {
        id: "content-topic-review",
        trigger: "Запущен AI draft run для блога",
        recipients: "Контент-администраторы",
        channels: ["telegramContent"],
        destination: "CONTENT_ASSISTANT_TELEGRAM_APPROVAL_CHAT_ID",
        message:
          "Темы для будущего draft в блоге: варианты тем, угол, обоснование, CTA, источники и кнопки утверждения.",
        conditions: [
          "Отправляется при наличии Telegram approval chat и bot token.",
        ],
        source: "telegram-approval.service.ts",
      },
      {
        id: "content-outline-review",
        trigger: "Контент-администратор утвердил тему AI draft run",
        recipients: "Контент-администраторы",
        channels: ["telegramContent"],
        destination: "CONTENT_ASSISTANT_TELEGRAM_APPROVAL_CHAT_ID",
        message:
          "Структура статьи: заголовок, блоки, заметки и кнопки утверждения структуры или отклонения.",
        conditions: ["Следующий шаг после утверждения темы."],
        source: "telegram-approval.service.ts",
      },
      {
        id: "content-draft-review",
        trigger: "Контент-администратор утвердил структуру AI draft run",
        recipients: "Контент-администраторы",
        channels: ["telegramContent"],
        destination: "CONTENT_ASSISTANT_TELEGRAM_APPROVAL_CHAT_ID",
        message:
          "Черновик готов к созданию draft: title, excerpt, slug, количество блоков и кнопки создания draft или отклонения.",
        conditions: ["Следующий шаг после утверждения структуры."],
        source: "telegram-approval.service.ts",
      },
      {
        id: "content-draft-result",
        trigger: "AI draft run создан, отклонен или завершился ошибкой",
        recipients: "Контент-администраторы",
        channels: ["telegramContent"],
        destination: "CONTENT_ASSISTANT_TELEGRAM_APPROVAL_CHAT_ID",
        message:
          "Результат AI draft run: созданный draft с ссылкой в админку, сообщение об отклонении или текст ошибки.",
        conditions: ["Финальный статус согласования или обработки."],
        source: "telegram-approval.service.ts",
      },
    ],
  },
];
