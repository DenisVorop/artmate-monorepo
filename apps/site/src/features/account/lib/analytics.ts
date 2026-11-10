import { createAnalytics, createInteractionCommand } from "@/shared/lib/analytics";

const analytics = createAnalytics({
  backOpened: () => createInteractionCommand("account_home_back", {}),
  orderDetailsOpened: () => createInteractionCommand("account_order_details_open", {}),
  orderDetailsClosed: () => createInteractionCommand("account_order_details_close", {}),
  orderPaymentOpened: () => createInteractionCommand("account_order_payment_open", {}),
  orderProductOpened: () => createInteractionCommand("account_order_product_open", {}),
  trackingCopied: () => createInteractionCommand("account_tracking_copy", {}),
  trackingOpened: () => createInteractionCommand("account_tracking_open", {}),
  settingsOpened: () => createInteractionCommand("account_settings_open", {}),
  ordersOpened: () => createInteractionCommand("account_orders_open", {}),
  ordersPrevious: () => createInteractionCommand("account_orders_previous", {}),
  ordersNext: () => createInteractionCommand("account_orders_next", {}),
  workshopOpened: () => createInteractionCommand("account_workshop_open", {}),
  coloringCatalogOpened: () => createInteractionCommand("account_coloring_catalog_open", {}),
  clubOpened: () => createInteractionCommand("account_club_open", {}),
  welcomeCodeCopied: () => createInteractionCommand("account_welcome_code_copy", {}),
  telegramBotOpened: () => createInteractionCommand("account_telegram_bot_open", {}),
  telegramLinkRequested: () => createInteractionCommand("account_telegram_link_request", {}),
  telegramLinked: () => createInteractionCommand("account_telegram_link_success", {}),
  telegramLinkFailed: () => createInteractionCommand("account_telegram_link_error", {}),
  telegramUnlinkOpened: () => createInteractionCommand("account_telegram_unlink_open", {}),
  telegramUnlinkDismissed: () => createInteractionCommand("account_telegram_unlink_dismiss", {}),
  telegramUnlinkRequested: () => createInteractionCommand("account_telegram_unlink_request", {}),
  telegramUnlinked: () => createInteractionCommand("account_telegram_unlink_success", {}),
  telegramUnlinkFailed: () => createInteractionCommand("account_telegram_unlink_error", {}),
});

const actions = {
  backOpened: () => analytics.send("backOpened"),
  orderDetailsOpened: () => analytics.send("orderDetailsOpened"),
  orderDetailsClosed: () => analytics.send("orderDetailsClosed"),
  orderPaymentOpened: () => analytics.send("orderPaymentOpened"),
  orderProductOpened: () => analytics.send("orderProductOpened"),
  trackingCopied: () => analytics.send("trackingCopied"),
  trackingOpened: () => analytics.send("trackingOpened"),
  settingsOpened: () => analytics.send("settingsOpened"),
  ordersOpened: () => analytics.send("ordersOpened"),
  ordersPrevious: () => analytics.send("ordersPrevious"),
  ordersNext: () => analytics.send("ordersNext"),
  workshopOpened: () => analytics.send("workshopOpened"),
  coloringCatalogOpened: () => analytics.send("coloringCatalogOpened"),
  clubOpened: () => analytics.send("clubOpened"),
  welcomeCodeCopied: () => analytics.send("welcomeCodeCopied"),
  telegramBotOpened: () => analytics.send("telegramBotOpened"),
  telegramLinkRequested: () => analytics.send("telegramLinkRequested"),
  telegramLinked: () => analytics.send("telegramLinked"),
  telegramLinkFailed: () => analytics.send("telegramLinkFailed"),
  telegramUnlinkOpened: () => analytics.send("telegramUnlinkOpened"),
  telegramUnlinkDismissed: () => analytics.send("telegramUnlinkDismissed"),
  telegramUnlinkRequested: () => analytics.send("telegramUnlinkRequested"),
  telegramUnlinked: () => analytics.send("telegramUnlinked"),
  telegramUnlinkFailed: () => analytics.send("telegramUnlinkFailed"),
};

export function useAnalytics() {
  return actions;
}
