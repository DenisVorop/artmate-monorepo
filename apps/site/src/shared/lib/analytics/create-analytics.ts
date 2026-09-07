import { markAnalyticsCommandSent, wasAnalyticsCommandSent } from "./dedupe";
import { mapAnalyticsProduct } from "./product";
import {
  isSensitiveAnalyticsParamName,
  isSensitiveAnalyticsParamValue,
} from "./sanitize-analytics-url";
import {
  diagnosticEventNames,
  ecommerceActions,
  yandexGoalEventIds,
  type AnalyticsBuilderResult,
  type AnalyticsCommand,
  type AnalyticsDedupe,
  type AnalyticsWindow,
  type AnalyticsProduct,
  type AnalyticsProductInput,
  type AnalyticsPromotion,
  type DiagnosticCommand,
  type DiagnosticEventName,
  type DiagnosticEventParams,
  type EcommerceAction,
  type EcommerceCommand,
  type EcommercePayloads,
  type GoalCommand,
  type YandexGoalEventId,
  type YandexGoalParams,
} from "./types";

export { mapAnalyticsProduct } from "./product";
export { diagnosticEventNames, ecommerceActions, yandexGoalEventIds } from "./types";
export type {
  AnalyticsBuilderResult,
  AnalyticsCommand,
  AnalyticsDedupe,
  AnalyticsDedupeScope,
  AnalyticsWindow,
  AnalyticsProduct,
  AnalyticsProductInput,
  AnalyticsPromotion,
  DiagnosticCommand,
  DiagnosticEventName,
  DiagnosticEventParams,
  EcommerceAction,
  EcommerceCommand,
  EcommercePayloads,
  GoalCommand,
  YandexGoalEventId,
  YandexGoalParams,
} from "./types";

type AnalyticsEventBuilder = (..._args: never[]) => AnalyticsBuilderResult;
type AnalyticsEventBuilders = Record<string, AnalyticsEventBuilder>;
type SafeParamValue = boolean | number | string;
type SafeParams = Record<string, SafeParamValue>;

const goalEventIds = new Set<string>(yandexGoalEventIds);
const diagnosticEvents = new Set<string>(diagnosticEventNames);
const ecommerceEventActions = new Set<string>(ecommerceActions);
const reservedParamKeys = new Set(["event", "ecommerce"]);
const goalParamKeys = {
  product_view: ["product_id", "category", "price", "currency"],
  add_to_cart: ["product_id", "category", "price", "quantity", "currency"],
  begin_checkout: ["cart_id", "items_count", "value", "currency"],
  promo_apply_success: ["discount", "currency"],
  welcome_promo_click: [],
  sign_up: [],
  digital_versions_opened: ["collection_slug"],
  digital_coloring_open: ["collection_slug", "coloring_number"],
  order_created: ["order_id", "items_count", "order_price", "currency"],
} satisfies {
  [EventId in YandexGoalEventId]: readonly (keyof YandexGoalParams[EventId])[];
};
const diagnosticParamKeys = {
  welcome_promo_dismiss: ["reason"],
  digital_open_from_product: ["product_id", "collection_slug"],
  account_recovery_requested: [],
  order_activation_completed: [],
} satisfies {
  [EventName in DiagnosticEventName]: readonly (keyof DiagnosticEventParams[EventName])[];
};

export function createAnalytics<const Builders extends AnalyticsEventBuilders>(builders: Builders) {
  return {
    send<Alias extends keyof Builders>(
      eventAlias: Alias,
      ...args: Parameters<Builders[Alias]>
    ): void {
      if (typeof window === "undefined") {
        return;
      }

      let result: AnalyticsBuilderResult;

      try {
        const builder = builders[eventAlias] as (
          ..._builderArgs: Parameters<Builders[Alias]>
        ) => AnalyticsBuilderResult;
        result = builder(...args);
      } catch {
        return;
      }

      const commands = (Array.isArray(result) ? result : [result]) as readonly AnalyticsCommand[];

      for (const command of commands) {
        try {
          if (isKnownCommand(command)) {
            sendCommand(command);
          }
        } catch {
          // Analytics must never interrupt the user action that triggered it.
        }
      }
    },
  };
}

export function createGoalCommand<EventId extends YandexGoalEventId>(
  eventId: EventId,
  params: YandexGoalParams[EventId],
  dedupe?: AnalyticsDedupe,
): GoalCommand<EventId> {
  return {
    kind: "goal",
    eventId,
    params,
    ...(dedupe ? { dedupe } : {}),
  } as GoalCommand<EventId>;
}

export function createDiagnosticCommand<EventName extends DiagnosticEventName>(
  event: EventName,
  params: DiagnosticEventParams[EventName],
  dedupe?: AnalyticsDedupe,
): DiagnosticCommand<EventName> {
  return {
    kind: "diagnostic",
    event,
    params,
    ...(dedupe ? { dedupe } : {}),
  } as DiagnosticCommand<EventName>;
}

export function createEcommerceCommand<Action extends EcommerceAction>(
  action: Action,
  payload: EcommercePayloads[Action],
  dedupe?: AnalyticsDedupe,
): EcommerceCommand<Action> {
  return {
    kind: "ecommerce",
    action,
    payload,
    ...(dedupe ? { dedupe } : {}),
  } as EcommerceCommand<Action>;
}

function sanitizeAnalyticsParams(params: unknown, allowedKeys: readonly string[]): SafeParams {
  if (!isRecord(params)) {
    return {};
  }

  const safeParams: SafeParams = {};
  const allowedParamKeys = new Set(allowedKeys);

  for (const [key, value] of Object.entries(params)) {
    if (!allowedParamKeys.has(key) || !isSafeParamKey(key) || !isSafeParamValue(value)) {
      continue;
    }

    safeParams[key] = typeof value === "string" ? value.trim() : value;
  }

  return safeParams;
}

function sendCommand(command: AnalyticsCommand) {
  if (wasAnalyticsCommandSent(command)) {
    return;
  }

  switch (command.kind) {
    case "goal": {
      if (sendGoal(command)) {
        markAnalyticsCommandSent(command);
      }
      return;
    }
    case "diagnostic": {
      if (sendDiagnostic(command)) {
        markAnalyticsCommandSent(command);
      }
      return;
    }
    case "ecommerce": {
      const ecommerce = createEcommercePayload(command);

      if (ecommerce && pushToDataLayer({ ecommerce })) {
        markAnalyticsCommandSent(command);
      }
      return;
    }
  }
}

function sendGoal(command: GoalCommand) {
  const params = normalizeGoalParams(command);

  if (!params) {
    return false;
  }

  const pushedToDataLayer = pushToDataLayer({ event: command.eventId, ...params });

  const counterId = getCounterId();
  const yandexMetrika = (window as AnalyticsWindow).ym;

  if (!counterId || !yandexMetrika) {
    return pushedToDataLayer;
  }

  try {
    yandexMetrika(counterId, "reachGoal", command.eventId, params);
    return true;
  } catch {
    // The queued or third-party ym implementation is outside application control.
    return pushedToDataLayer;
  }
}

function sendDiagnostic(command: DiagnosticCommand) {
  const params = normalizeDiagnosticParams(command);

  if (!params) {
    return false;
  }

  return pushToDataLayer({
    event: command.event,
    ...params,
  });
}

function normalizeGoalParams(command: GoalCommand): SafeParams | null {
  const params = sanitizeAnalyticsParams(command.params, goalParamKeys[command.eventId]);

  switch (command.eventId) {
    case "product_view":
      return hasRequiredProductViewParams(params) ? params : null;
    case "add_to_cart":
      return hasRequiredProductViewParams(params) && isPositiveIntegerParam(params, "quantity")
        ? params
        : null;
    case "begin_checkout":
      return isNonEmptyStringParam(params, "cart_id") &&
        isPositiveIntegerParam(params, "items_count") &&
        isNonNegativeNumberParam(params, "value") &&
        hasRubCurrency(params)
        ? params
        : null;
    case "promo_apply_success":
      return isPositiveNumberParam(params, "discount") && hasRubCurrency(params) ? params : null;
    case "welcome_promo_click":
    case "sign_up":
      return params;
    case "digital_versions_opened":
      return isOptionalNonEmptyStringParam(params, "collection_slug") ? params : null;
    case "digital_coloring_open":
      return isNonEmptyStringParam(params, "collection_slug") &&
        isPositiveIntegerParam(params, "coloring_number")
        ? params
        : null;
    case "order_created":
      return isNonEmptyStringParam(params, "order_id") &&
        isPositiveIntegerParam(params, "items_count") &&
        isNonNegativeNumberParam(params, "order_price") &&
        hasRubCurrency(params)
        ? params
        : null;
  }
}

function normalizeDiagnosticParams(command: DiagnosticCommand): SafeParams | null {
  const params = sanitizeAnalyticsParams(command.params, diagnosticParamKeys[command.event]);

  switch (command.event) {
    case "welcome_promo_dismiss":
      return params.reason === undefined ||
        params.reason === "close" ||
        params.reason === "not_now" ||
        params.reason === "navigation"
        ? params
        : null;
    case "digital_open_from_product":
      return isNonEmptyStringParam(params, "product_id") &&
        isNonEmptyStringParam(params, "collection_slug")
        ? params
        : null;
    case "account_recovery_requested":
    case "order_activation_completed":
      return params;
  }
}

function hasRequiredProductViewParams(params: SafeParams) {
  return (
    isNonEmptyStringParam(params, "product_id") &&
    isOptionalNonEmptyStringParam(params, "category") &&
    isNonNegativeNumberParam(params, "price") &&
    hasRubCurrency(params)
  );
}

function hasRubCurrency(params: SafeParams) {
  return params.currency === "RUB";
}

function isNonEmptyStringParam(params: SafeParams, key: string) {
  return typeof params[key] === "string" && params[key].length > 0;
}

function isOptionalNonEmptyStringParam(params: SafeParams, key: string) {
  return params[key] === undefined || isNonEmptyStringParam(params, key);
}

function isNonNegativeNumberParam(params: SafeParams, key: string) {
  return typeof params[key] === "number" && Number.isFinite(params[key]) && params[key] >= 0;
}

function isPositiveNumberParam(params: SafeParams, key: string) {
  return typeof params[key] === "number" && Number.isFinite(params[key]) && params[key] > 0;
}

function isPositiveIntegerParam(params: SafeParams, key: string) {
  return isPositiveNumberParam(params, key) && Number.isInteger(params[key]);
}

function pushToDataLayer(payload: unknown) {
  try {
    const analyticsWindow = window as AnalyticsWindow;
    analyticsWindow.dataLayer ??= [];
    analyticsWindow.dataLayer.push(payload);
    return true;
  } catch {
    // A blocked/frozen analytics container must not affect the storefront.
    return false;
  }
}

function createEcommercePayload(command: EcommerceCommand): Record<string, unknown> | null {
  switch (command.action) {
    case "click":
    case "detail":
    case "add":
    case "remove": {
      const products = normalizeProducts(command.payload.products);

      if (products.length === 0) {
        return null;
      }

      return {
        currencyCode: "RUB",
        [command.action]: { products },
      };
    }
    case "promoView":
    case "promoClick": {
      const promotions = normalizePromotions(command.payload.promotions);

      if (promotions.length === 0) {
        return null;
      }

      return {
        currencyCode: "RUB",
        [command.action]: { promotions },
      };
    }
    case "purchase": {
      const products = normalizeProducts(command.payload.products);
      const actionField = normalizePurchaseActionField(command.payload.actionField);

      if (products.length === 0 || !actionField) {
        return null;
      }

      return {
        currencyCode: "RUB",
        purchase: { actionField, products },
      };
    }
  }
}

function normalizeProducts(products: readonly AnalyticsProduct[]) {
  if (!Array.isArray(products)) {
    return [];
  }

  return products
    .map((product) => mapAnalyticsProduct(product as AnalyticsProductInput))
    .filter((product): product is AnalyticsProduct => product !== null);
}

function normalizePromotions(promotions: readonly AnalyticsPromotion[]) {
  if (!Array.isArray(promotions)) {
    return [];
  }

  return promotions.flatMap((promotion) => {
    if (!isRecord(promotion)) {
      return [];
    }

    const id = normalizeText(promotion.id);
    const name = normalizeText(promotion.name);

    if (!id || !name) {
      return [];
    }

    const creative = normalizeText(promotion.creative);
    const position = normalizeText(promotion.position);

    return [
      {
        id,
        name,
        ...(creative ? { creative } : {}),
        ...(position ? { position } : {}),
      },
    ];
  });
}

function normalizePurchaseActionField(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeText(value.id);
  const revenue = value.revenue;

  if (!id || typeof revenue !== "number" || !Number.isFinite(revenue) || revenue < 0) {
    return null;
  }

  const coupon = normalizeText(value.coupon);

  return {
    id,
    revenue,
    ...(coupon ? { coupon } : {}),
  };
}

function getCounterId() {
  let rawCounterId: string | undefined;

  try {
    rawCounterId =
      (window as AnalyticsWindow).document
        ?.getElementById("yandex-metrika")
        ?.getAttribute("data-counter-id") ?? undefined;
  } catch {
    rawCounterId = undefined;
  }

  if (!rawCounterId && typeof process !== "undefined") {
    rawCounterId = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
  }

  if (!rawCounterId) {
    return null;
  }

  const counterId = Number(rawCounterId);
  return Number.isInteger(counterId) && counterId > 0 ? counterId : null;
}

function isKnownCommand(command: unknown): command is AnalyticsCommand {
  if (!isRecord(command) || typeof command.kind !== "string") {
    return false;
  }

  if (command.kind === "goal") {
    return typeof command.eventId === "string" && goalEventIds.has(command.eventId);
  }

  if (command.kind === "diagnostic") {
    return typeof command.event === "string" && diagnosticEvents.has(command.event);
  }

  return (
    command.kind === "ecommerce" &&
    typeof command.action === "string" &&
    ecommerceEventActions.has(command.action)
  );
}

function isSafeParamKey(key: string) {
  const normalized = normalizeParamKey(key);

  if (!normalized || reservedParamKeys.has(normalized) || isSensitiveAnalyticsParamName(key)) {
    return false;
  }

  return true;
}

function isSafeParamValue(value: unknown): value is SafeParamValue {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0;
  }

  if (typeof value === "string") {
    return value.trim().length > 0 && value.length <= 512 && !isSensitiveAnalyticsParamValue(value);
  }

  return typeof value === "boolean";
}

function normalizeParamKey(key: string) {
  return key.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
