import { getCookieConsentSnapshot } from "@/shared/lib/cookie-consent";

import { markAnalyticsCommandSent, wasAnalyticsCommandSent } from "./dedupe";
import { mapAnalyticsProduct } from "./product";
import {
  isSensitiveAnalyticsParamName,
  isSensitiveAnalyticsParamValue,
} from "./sanitize-analytics-url";
import {
  diagnosticEventNames,
  namedSiteGoalParamKeys,
  interactionEventParamKeys,
  type InteractionCommand,
  type InteractionEventId,
  type InteractionEventParams,
  type NamedSiteGoalId,
  ecommerceActions,
  siteActions,
  siteAreas,
  siteSections,
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
  InteractionCommand,
  InteractionEventId,
  InteractionEventParams,
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
  ...namedSiteGoalParamKeys,
  site_navigation: ["from_section", "to_section", "placement"],
  site_scroll_depth: ["section", "percent"],
  site_interaction: ["section", "action"],
  feedback_submit_success: ["form"],
  product_view: ["product_id", "category", "price", "currency"],
  add_to_cart: ["product_id", "category", "price", "quantity", "currency"],
  begin_checkout: ["cart_id", "items_count", "value", "currency"],
  promo_apply_success: ["discount", "currency"],
  welcome_promo_click: [],
  sign_up: [],
  partner_cta_click: [],
  partner_form_start: [],
  partner_form_success: [],
  partner_form_error: [],
  digital_versions_opened: ["collection_slug"],
  digital_coloring_open: ["collection_slug", "coloring_number"],
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

export function createInteractionCommand<EventId extends InteractionEventId>(
  eventId: EventId,
  params: InteractionEventParams[EventId],
  dedupe?: AnalyticsDedupe,
): InteractionCommand<EventId> {
  return {
    kind: "interaction",
    eventId,
    params,
    ...(dedupe ? { dedupe } : {}),
  } as InteractionCommand<EventId>;
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
    case "interaction": {
      if (sendInteraction(command)) {
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
  const isPartnerEvent = command.eventId.startsWith("partner_");
  const requiresConsent =
    isPartnerEvent ||
    command.eventId.startsWith("site_") ||
    isNamedSiteGoal(command.eventId) ||
    command.eventId === "feedback_submit_success";
  if (requiresConsent && !getCookieConsentSnapshot()) return false;
  const params = normalizeGoalParams(command);

  if (!params) {
    return false;
  }

  let googleSent = false;
  if (isPartnerEvent) {
    try {
      const googleAnalytics = (window as Window & { gtag?: (..._args: unknown[]) => void }).gtag;
      if (googleAnalytics) {
        googleAnalytics("event", command.eventId, {
          event_category: "partner_program",
        });
        googleSent = true;
      }
    } catch {
      // Third-party analytics cannot interrupt a business action.
    }
  }
  const pushedToDataLayer = isPartnerEvent
    ? googleSent
    : pushToDataLayer({ event: command.eventId, ...params });

  const counterId = getCounterId();
  const yandexMetrika = (window as AnalyticsWindow).ym;

  if (!counterId || !yandexMetrika) {
    return pushedToDataLayer;
  }

  try {
    if (isPartnerEvent) yandexMetrika(counterId, "reachGoal", command.eventId);
    else yandexMetrika(counterId, "reachGoal", command.eventId, params);
    return true;
  } catch {
    // The queued or third-party ym implementation is outside application control.
    return pushedToDataLayer;
  }
}

function sendInteraction(command: InteractionCommand) {
  if (!getCookieConsentSnapshot()) return false;

  const keys = interactionEventParamKeys[command.eventId];
  const params = sanitizeAnalyticsParams(command.params, keys);
  if (!keys.every((key) => isNamedSiteParam(key, params))) return false;

  const pushedToDataLayer = pushToDataLayer({ event: command.eventId, ...params });
  const counterId = getCounterId();
  const ym = (window as AnalyticsWindow).ym;

  if (!counterId || !ym) return pushedToDataLayer;

  try {
    ym(counterId, "params", {
      artmate_action: command.eventId,
      ...(keys.length ? { artmate_action_context: { [command.eventId]: params } } : {}),
    });
    return true;
  } catch {
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

  if (isNamedSiteGoal(command.eventId)) {
    return namedSiteGoalParamKeys[command.eventId].every((key) => isNamedSiteParam(key, params))
      ? params
      : null;
  }

  switch (command.eventId) {
    case "feedback_submit_success":
      return params.form === "contact" || params.form === "wholesale" ? params : null;
    case "site_navigation":
      return includesParam(siteSections, params.from_section) &&
        includesParam(siteSections, params.to_section) &&
        includesParam(siteAreas, params.placement)
        ? params
        : null;
    case "site_scroll_depth":
      return includesParam(siteSections, params.section) &&
        [25, 50, 75, 100].some((percent) => percent === params.percent)
        ? params
        : null;
    case "site_interaction":
      return includesParam(siteSections, params.section) &&
        includesParam(siteActions, params.action)
        ? params
        : null;
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
    case "partner_cta_click":
    case "partner_form_start":
    case "partner_form_success":
    case "partner_form_error":
      return params;
    case "digital_versions_opened":
      return isOptionalNonEmptyStringParam(params, "collection_slug") ? params : null;
    case "digital_coloring_open":
      return isNonEmptyStringParam(params, "collection_slug") &&
        isPositiveIntegerParam(params, "coloring_number")
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

function includesParam(values: readonly string[], value: SafeParamValue | undefined) {
  return typeof value === "string" && values.includes(value);
}

function isNamedSiteGoal(value: YandexGoalEventId): value is NamedSiteGoalId {
  return Object.hasOwn(namedSiteGoalParamKeys, value);
}

function isNamedSiteParam(
  key:
    | (typeof namedSiteGoalParamKeys)[NamedSiteGoalId][number]
    | (typeof interactionEventParamKeys)[InteractionEventId][number],
  params: SafeParams,
) {
  switch (key) {
    case "contest_slug":
      return (
        typeof params.contest_slug === "string" &&
        /^(?=.{1,120}$)[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.contest_slug)
      );
    case "sort":
      return includesParam(["featured", "newest", "price-asc", "price-desc"], params.sort);
    case "catalog_category":
      return includesParam(["all", "colorings", "markers"], params.catalog_category);
    case "filter_kind":
      return includesParam(
        ["minimum_price", "maximum_price", "availability", "bestsellers", "tag"],
        params.filter_kind,
      );
    case "delivery_provider":
      return includesParam(["ozon", "cdek"], params.delivery_provider);
    case "payment_method":
      return includesParam(["tbank_acquiring", "ozon_acquiring"], params.payment_method);
    case "source":
      return includesParam(
        ["header", "mobile_menu", "footer", "home", "product", "gallery", "digital"],
        params.source,
      );
    case "position":
    case "coloring_number":
      return isPositiveIntegerParam(params, key);
    case "percent":
      return isNonNegativeNumberParam(params, key) && Number(params.percent) <= 100;
    case "mode":
      return params.mode === "carousel" || params.mode === "lightbox";
    case "subject_type":
      return params.subject_type === "community-work" || params.subject_type === "blog-post";
    default:
      return isPublicMediaKey(params[key]);
  }
}

function isPublicMediaKey(value: SafeParamValue | undefined) {
  return typeof value === "string" && /^[a-z0-9_-]{1,96}$/i.test(value);
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
    case "impressions": {
      const products = normalizeProducts(command.payload.products);
      return products.length > 0 ? { currencyCode: "RUB", impressions: products } : null;
    }
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

  if (command.kind === "interaction") {
    return (
      typeof command.eventId === "string" &&
      Object.hasOwn(interactionEventParamKeys, command.eventId)
    );
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
