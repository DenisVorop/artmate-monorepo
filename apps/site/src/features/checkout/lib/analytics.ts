import type { Cart } from "@/entities/cart";
import type { Order } from "@/entities/orders";
import {
  createAnalytics,
  createEcommerceCommand,
  createGoalCommand,
  createInteractionCommand,
  type InteractionEventParams,
  mapAnalyticsProduct,
  type AnalyticsProduct,
} from "@/shared/lib/analytics";

type OrderSummaryAnalyticsPayload = {
  itemsCount: number;
  orderId: string;
  revenue: number;
};

type OrderPaidAnalyticsPayload = OrderSummaryAnalyticsPayload & {
  products: readonly AnalyticsProduct[];
  coupon?: string;
};

const analytics = createAnalytics({
  shipmentTrackingOpened: () => createInteractionCommand("checkout_tracking_open", {}),
  shipmentTrackingCopied: () => createInteractionCommand("checkout_tracking_copy", {}),
  orderSubmitClicked: () => createInteractionCommand("checkout_submit_click", {}),
  orderFormInvalid: () => createInteractionCommand("checkout_form_invalid", {}),
  orderSubmitted: () => createInteractionCommand("checkout_submit", {}),
  orderCreateFailed: () => createInteractionCommand("checkout_create_error", {}),
  paymentRedirected: () => createInteractionCommand("payment_redirect", {}),
  deliverySelected: (
    value: InteractionEventParams["delivery_method_select"]["delivery_provider"],
  ) => createInteractionCommand("delivery_method_select", { delivery_provider: value }),
  pickupConfirmed: (value: InteractionEventParams["pickup_point_confirm"]["delivery_provider"]) =>
    createInteractionCommand("pickup_point_confirm", { delivery_provider: value }),
  paymentSelected: (value: InteractionEventParams["payment_method_select"]["payment_method"]) =>
    createInteractionCommand("payment_method_select", { payment_method: value }),
  pickupPickerOpened: () => createInteractionCommand("pickup_picker_open", {}),
  pickupPickerDismissed: () => createInteractionCommand("pickup_picker_dismiss", {}),
  pickupProviderChanged: (
    value: InteractionEventParams["pickup_provider_change"]["delivery_provider"],
  ) => createInteractionCommand("pickup_provider_change", { delivery_provider: value }),
  pickupConfirmRequested: () => createInteractionCommand("pickup_point_confirm_request", {}),
  pickupConfirmFailed: () => createInteractionCommand("pickup_point_confirm_error", {}),
  pickupCitySelected: () => createInteractionCommand("pickup_city_select", {}),
  pickupPointSelectedFromList: () => createInteractionCommand("pickup_point_list_select", {}),
  pickupPointSelectedFromMap: () => createInteractionCommand("pickup_point_map_select", {}),
  pickupCityOpened: () => createInteractionCommand("pickup_city_open", {}),
  pickupCityClosed: () => createInteractionCommand("pickup_city_close", {}),
  pickupListOpened: () => createInteractionCommand("pickup_list_open", {}),
  pickupListClosed: () => createInteractionCommand("pickup_list_close", {}),
  pickupCitiesRetried: () => createInteractionCommand("pickup_cities_retry", {}),
  pickupPointsRetried: () => createInteractionCommand("pickup_points_retry", {}),
  pickupCityRetried: () => createInteractionCommand("pickup_city_retry", {}),
  calculationRetried: () => createInteractionCommand("checkout_calculation_retry", {}),
  emptyCatalogOpened: () => createInteractionCommand("checkout_empty_catalog_open", {}),
  cartOpened: () => createInteractionCommand("checkout_cart_open", {}),
  paymentReturnOwner: () => createInteractionCommand("payment_return_owner", {}),
  paymentReturnGuest: () => createInteractionCommand("payment_return_guest", {}),
  paymentReturnFailure: () => createInteractionCommand("payment_return_failure", {}),
  paymentRecoveryRequested: () => createInteractionCommand("payment_recovery_request", {}),
  paymentRecoveryFailed: () => createInteractionCommand("payment_recovery_error", {}),
  paymentRetryRedirected: () => createInteractionCommand("payment_recovery_redirect", {}),
  successCatalogOpened: () => createInteractionCommand("checkout_success_catalog_open", {}),
  successSupportOpened: () => createInteractionCommand("checkout_success_support_open", {}),
  failureCatalogOpened: () => createInteractionCommand("checkout_failure_catalog_open", {}),
  failureSupportOpened: () => createInteractionCommand("checkout_failure_support_open", {}),
  loyaltyOpened: () => createInteractionCommand("checkout_loyalty_open", {}),
  loyaltyClosed: () => createInteractionCommand("checkout_loyalty_close", {}),
  loyaltyLogin: () => createInteractionCommand("checkout_loyalty_login", {}),
  loyaltyClubOpened: () => createInteractionCommand("checkout_loyalty_club_open", {}),
  loyaltyEditOpened: () => createInteractionCommand("checkout_loyalty_edit_open", {}),
  loyaltyEditClosed: () => createInteractionCommand("checkout_loyalty_edit_close", {}),
  loyaltyEnabled: () => createInteractionCommand("checkout_loyalty_enable", {}),
  loyaltyDisabled: () => createInteractionCommand("checkout_loyalty_disable", {}),
  loyaltyAmountSelected: () => createInteractionCommand("checkout_loyalty_amount_select", {}),
  loyaltyMaximumSelected: () => createInteractionCommand("checkout_loyalty_max_select", {}),
  offerOpened: () => createInteractionCommand("checkout_offer_open", {}),
  offerAccepted: () => createInteractionCommand("checkout_offer_accept", {}),
  offerUnchecked: () => createInteractionCommand("checkout_offer_uncheck", {}),
  dataConsentChecked: () => createInteractionCommand("checkout_data_consent_check", {}),
  dataConsentUnchecked: () => createInteractionCommand("checkout_data_consent_uncheck", {}),
  checkoutStarted: (cart: Cart, attemptKey: string) =>
    createGoalCommand(
      "begin_checkout",
      {
        cart_id: cart.id,
        items_count: cart.itemsCount,
        value: cart.total,
        currency: cart.currency,
      },
      { scope: "memory", entityKey: attemptKey },
    ),
  orderPurchased: (payload: OrderPaidAnalyticsPayload) =>
    createEcommerceCommand(
      "purchase",
      {
        actionField: {
          id: payload.orderId,
          revenue: payload.revenue,
          ...(payload.coupon ? { coupon: payload.coupon } : {}),
        },
        products: payload.products,
      },
      { scope: "local", entityKey: payload.orderId },
    ),
});

const checkoutAnalytics = {
  shipmentTrackingOpened: () => analytics.send("shipmentTrackingOpened"),
  shipmentTrackingCopied: () => analytics.send("shipmentTrackingCopied"),
  orderSubmitClicked: () => analytics.send("orderSubmitClicked"),
  orderFormInvalid: () => analytics.send("orderFormInvalid"),
  orderSubmitted: () => analytics.send("orderSubmitted"),
  orderCreateFailed: () => analytics.send("orderCreateFailed"),
  paymentRedirected: () => analytics.send("paymentRedirected"),
  deliverySelected: (
    value: InteractionEventParams["delivery_method_select"]["delivery_provider"],
  ) => analytics.send("deliverySelected", value),
  pickupConfirmed: (value: InteractionEventParams["pickup_point_confirm"]["delivery_provider"]) =>
    analytics.send("pickupConfirmed", value),
  paymentSelected: (value: InteractionEventParams["payment_method_select"]["payment_method"]) =>
    analytics.send("paymentSelected", value),
  pickupPickerOpened: () => analytics.send("pickupPickerOpened"),
  pickupPickerDismissed: () => analytics.send("pickupPickerDismissed"),
  pickupProviderChanged: (
    value: InteractionEventParams["pickup_provider_change"]["delivery_provider"],
  ) => analytics.send("pickupProviderChanged", value),
  pickupConfirmRequested: () => analytics.send("pickupConfirmRequested"),
  pickupConfirmFailed: () => analytics.send("pickupConfirmFailed"),
  pickupCitySelected: () => analytics.send("pickupCitySelected"),
  pickupPointSelectedFromList: () => analytics.send("pickupPointSelectedFromList"),
  pickupPointSelectedFromMap: () => analytics.send("pickupPointSelectedFromMap"),
  pickupCityOpened: () => analytics.send("pickupCityOpened"),
  pickupCityClosed: () => analytics.send("pickupCityClosed"),
  pickupListOpened: () => analytics.send("pickupListOpened"),
  pickupListClosed: () => analytics.send("pickupListClosed"),
  pickupCitiesRetried: () => analytics.send("pickupCitiesRetried"),
  pickupPointsRetried: () => analytics.send("pickupPointsRetried"),
  pickupCityRetried: () => analytics.send("pickupCityRetried"),
  calculationRetried: () => analytics.send("calculationRetried"),
  emptyCatalogOpened: () => analytics.send("emptyCatalogOpened"),
  cartOpened: () => analytics.send("cartOpened"),
  paymentReturnOwner: () => analytics.send("paymentReturnOwner"),
  paymentReturnGuest: () => analytics.send("paymentReturnGuest"),
  paymentReturnFailure: () => analytics.send("paymentReturnFailure"),
  paymentRecoveryRequested: () => analytics.send("paymentRecoveryRequested"),
  paymentRecoveryFailed: () => analytics.send("paymentRecoveryFailed"),
  paymentRetryRedirected: () => analytics.send("paymentRetryRedirected"),
  successCatalogOpened: () => analytics.send("successCatalogOpened"),
  successSupportOpened: () => analytics.send("successSupportOpened"),
  failureCatalogOpened: () => analytics.send("failureCatalogOpened"),
  failureSupportOpened: () => analytics.send("failureSupportOpened"),
  loyaltyOpened: () => analytics.send("loyaltyOpened"),
  loyaltyClosed: () => analytics.send("loyaltyClosed"),
  loyaltyLogin: () => analytics.send("loyaltyLogin"),
  loyaltyClubOpened: () => analytics.send("loyaltyClubOpened"),
  loyaltyEditOpened: () => analytics.send("loyaltyEditOpened"),
  loyaltyEditClosed: () => analytics.send("loyaltyEditClosed"),
  loyaltyEnabled: () => analytics.send("loyaltyEnabled"),
  loyaltyDisabled: () => analytics.send("loyaltyDisabled"),
  loyaltyAmountSelected: () => analytics.send("loyaltyAmountSelected"),
  loyaltyMaximumSelected: () => analytics.send("loyaltyMaximumSelected"),
  offerOpened: () => analytics.send("offerOpened"),
  offerAccepted: () => analytics.send("offerAccepted"),
  offerUnchecked: () => analytics.send("offerUnchecked"),
  dataConsentChecked: () => analytics.send("dataConsentChecked"),
  dataConsentUnchecked: () => analytics.send("dataConsentUnchecked"),
  checkoutStarted(cart: Cart, attemptKey: string) {
    if (cart.items.length === 0 || cart.itemsCount <= 0) {
      return;
    }

    analytics.send("checkoutStarted", cart, attemptKey);
  },

  orderPaid(order: Order | undefined) {
    if (order?.payment.status !== "paid") {
      return;
    }

    const summary = getOrderSummaryAnalyticsPayload(order);

    if (!summary) {
      return;
    }

    const purchase = getOrderPaidAnalyticsPayload(order);

    if (purchase) {
      analytics.send("orderPurchased", purchase);
    }
  },
};

export function useAnalytics() {
  return checkoutAnalytics;
}

function getOrderSummaryAnalyticsPayload(order: Order): OrderSummaryAnalyticsPayload | null {
  const orderId = order.id.trim();
  const revenue = order.subtotal - order.discount;

  if (
    !orderId ||
    order.currency !== "RUB" ||
    !Number.isInteger(order.itemsCount) ||
    order.itemsCount <= 0 ||
    !Number.isFinite(revenue) ||
    revenue < 0
  ) {
    return null;
  }

  return {
    itemsCount: order.itemsCount,
    orderId,
    revenue,
  };
}

function getOrderPaidAnalyticsPayload(order: Order): OrderPaidAnalyticsPayload | null {
  const summary = getOrderSummaryAnalyticsPayload(order);

  if (!summary) {
    return null;
  }

  const products = order.items.map((item) =>
    mapAnalyticsProduct({
      id: item.id,
      name: item.title,
      price: item.price,
      category: item.category,
      quantity: item.quantity,
    }),
  );

  if (
    products.some((product) => product === null) ||
    products.reduce((total, product) => total + (product?.quantity ?? 0), 0) !== order.itemsCount
  ) {
    return null;
  }

  const coupon = order.promoCode?.trim();

  return {
    ...summary,
    products: products as AnalyticsProduct[],
    ...(coupon ? { coupon } : {}),
  };
}
