export const yandexGoalEventIds = [
  "product_view",
  "add_to_cart",
  "begin_checkout",
  "promo_apply_success",
  "welcome_promo_click",
  "sign_up",
  "digital_versions_opened",
  "digital_coloring_open",
  "order_created",
  "order_paid",
] as const;

export type YandexGoalEventId = (typeof yandexGoalEventIds)[number];

type RubCurrency = "RUB";
type EmptyAnalyticsParams = { readonly [key: string]: never };

export type YandexGoalParams = {
  product_view: {
    product_id: string;
    category?: string;
    price: number;
    currency: RubCurrency;
  };
  add_to_cart: {
    product_id: string;
    category?: string;
    price: number;
    quantity: number;
    currency: RubCurrency;
  };
  begin_checkout: {
    cart_id: string;
    items_count: number;
    value: number;
    currency: RubCurrency;
  };
  promo_apply_success: {
    discount: number;
    currency: RubCurrency;
  };
  welcome_promo_click: EmptyAnalyticsParams;
  sign_up: EmptyAnalyticsParams;
  digital_versions_opened: {
    collection_slug?: string;
  };
  digital_coloring_open: {
    collection_slug: string;
    coloring_number: number;
  };
  order_created: {
    order_id: string;
    items_count: number;
    order_price: number;
    currency: RubCurrency;
  };
  order_paid: {
    order_id: string;
    items_count: number;
    order_price: number;
    currency: RubCurrency;
  };
};

export const diagnosticEventNames = ["welcome_promo_dismiss", "digital_open_from_product"] as const;

export type DiagnosticEventName = (typeof diagnosticEventNames)[number];

export type DiagnosticEventParams = {
  welcome_promo_dismiss: {
    reason?: "close" | "not_now" | "navigation";
  };
  digital_open_from_product: {
    product_id: string;
    collection_slug: string;
  };
};

export type AnalyticsDedupeScope = "memory" | "session" | "local";

export type AnalyticsDedupe = {
  scope: AnalyticsDedupeScope;
  entityKey: string;
};

export type AnalyticsProductInput = {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  quantity?: number;
  list?: string;
  position?: number;
};

export type AnalyticsProduct = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  list?: string;
  position?: number;
};

export type AnalyticsPromotion = {
  id: string;
  name: string;
  creative?: string;
  position?: string;
};

export const ecommerceActions = [
  "click",
  "detail",
  "add",
  "remove",
  "promoView",
  "promoClick",
  "purchase",
] as const;

export type EcommerceAction = (typeof ecommerceActions)[number];

type ProductActionPayload = {
  products: readonly AnalyticsProduct[];
};

type PromotionActionPayload = {
  promotions: readonly AnalyticsPromotion[];
};

export type EcommercePayloads = {
  click: ProductActionPayload;
  detail: ProductActionPayload;
  add: ProductActionPayload;
  remove: ProductActionPayload;
  promoView: PromotionActionPayload;
  promoClick: PromotionActionPayload;
  purchase: {
    actionField: {
      id: string;
      revenue: number;
      coupon?: string;
    };
    products: readonly AnalyticsProduct[];
  };
};

export type GoalCommand<EventId extends YandexGoalEventId = YandexGoalEventId> =
  EventId extends YandexGoalEventId
    ? {
        kind: "goal";
        eventId: EventId;
        params: YandexGoalParams[EventId];
        dedupe?: AnalyticsDedupe;
      }
    : never;

export type DiagnosticCommand<EventName extends DiagnosticEventName = DiagnosticEventName> =
  EventName extends DiagnosticEventName
    ? {
        kind: "diagnostic";
        event: EventName;
        params: DiagnosticEventParams[EventName];
        dedupe?: AnalyticsDedupe;
      }
    : never;

export type EcommerceCommand<Action extends EcommerceAction = EcommerceAction> =
  Action extends EcommerceAction
    ? {
        kind: "ecommerce";
        action: Action;
        payload: EcommercePayloads[Action];
        dedupe?: AnalyticsDedupe;
      }
    : never;

export type AnalyticsCommand = GoalCommand | DiagnosticCommand | EcommerceCommand;

export type AnalyticsBuilderResult = AnalyticsCommand | readonly AnalyticsCommand[];

export type YandexMetrikaFunction = {
  (..._args: unknown[]): void;
  a?: unknown[][];
  l?: number;
};

export type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  ym?: YandexMetrikaFunction;
};
