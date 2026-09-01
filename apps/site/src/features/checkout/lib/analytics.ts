import type { Cart } from "@/entities/cart";
import type { Order } from "@/entities/orders";
import {
  createAnalytics,
  createEcommerceCommand,
  createGoalCommand,
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
  orderCreated: (payload: OrderSummaryAnalyticsPayload) =>
    createGoalCommand(
      "order_created",
      {
        order_id: payload.orderId,
        items_count: payload.itemsCount,
        order_price: payload.revenue,
        currency: "RUB",
      },
      { scope: "session", entityKey: payload.orderId },
    ),
  orderPaid: (payload: OrderSummaryAnalyticsPayload) =>
    createGoalCommand(
      "order_paid",
      {
        order_id: payload.orderId,
        items_count: payload.itemsCount,
        order_price: payload.revenue,
        currency: "RUB",
      },
      { scope: "local", entityKey: payload.orderId },
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
  checkoutStarted(cart: Cart, attemptKey: string) {
    if (cart.items.length === 0 || cart.itemsCount <= 0) {
      return;
    }

    analytics.send("checkoutStarted", cart, attemptKey);
  },

  orderCreated(order: Order | undefined) {
    const payload = order ? getOrderSummaryAnalyticsPayload(order) : null;

    if (payload) {
      analytics.send("orderCreated", payload);
    }
  },

  orderPaid(order: Order | undefined) {
    if (order?.payment.status !== "paid") {
      return;
    }

    const summary = getOrderSummaryAnalyticsPayload(order);

    if (!summary) {
      return;
    }

    analytics.send("orderPaid", summary);

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
