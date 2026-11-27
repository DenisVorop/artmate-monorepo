const pictureContext = ["collection_slug", "coloring_number"] as const;

export const interactionEventParamKeys = {
  account_achievements_filter: [],
  account_achievements_open: [],
  account_club_open: [],
  account_coloring_catalog_open: [],
  account_email_settings_retry: [],
  account_email_subscribe_error: [],
  account_email_subscribe_request: [],
  account_email_subscribe_success: [],
  account_email_unsubscribe_error: [],
  account_email_unsubscribe_request: [],
  account_email_unsubscribe_success: [],
  account_home_back: [],
  account_login_open: [],
  account_logout_request: [],
  account_logout_success: [],
  account_menu_account_open: [],
  account_menu_close: [],
  account_menu_open: [],
  account_menu_workshop_open: [],
  account_order_details_close: [],
  account_order_details_open: [],
  account_order_payment_open: [],
  account_order_product_open: [],
  account_orders_next: [],
  account_orders_open: [],
  account_orders_previous: [],
  account_settings_open: [],
  account_telegram_bot_open: [],
  account_telegram_link_error: [],
  account_telegram_link_request: [],
  account_telegram_link_success: [],
  account_telegram_unlink_dismiss: [],
  account_telegram_unlink_error: [],
  account_telegram_unlink_open: [],
  account_telegram_unlink_request: [],
  account_telegram_unlink_success: [],
  account_tracking_copy: [],
  account_tracking_open: [],
  account_welcome_code_copy: [],
  account_workshop_open: [],
  cart_add_error: [],
  cart_checkout_click: [],
  cart_continue_shopping: [],
  cart_empty_catalog_open: [],
  cart_item_remove: ["product_id"],
  cart_product_open: ["product_id"],
  cart_quantity_decrease: ["product_id"],
  cart_quantity_error: [],
  cart_quantity_increase: ["product_id"],
  cart_remove_error: [],
  cart_toast_open: [],
  catalog_availability_disable: [],
  catalog_availability_enable: [],
  catalog_bestsellers_disable: [],
  catalog_bestsellers_enable: [],
  catalog_categories_close: [],
  catalog_categories_open: [],
  catalog_category_select: ["catalog_category"],
  catalog_filter_group_close: [],
  catalog_filter_group_open: [],
  catalog_filter_remove: ["filter_kind"],
  catalog_filters_apply: [],
  catalog_filters_close: [],
  catalog_filters_open: [],
  catalog_filters_reset: [],
  catalog_landing_click: ["landing_slug"],
  catalog_landings_collapse: [],
  catalog_landings_expand: [],
  catalog_price_change: [],
  catalog_search: [],
  catalog_search_clear: [],
  catalog_sort: ["sort"],
  catalog_sort_close: [],
  catalog_sort_open: [],
  catalog_tag_add: [],
  catalog_tag_remove: [],
  checkout_calculation_retry: [],
  checkout_cart_open: [],
  checkout_create_error: [],
  checkout_data_consent_check: [],
  checkout_data_consent_uncheck: [],
  checkout_empty_catalog_open: [],
  checkout_failure_catalog_open: [],
  checkout_failure_support_open: [],
  checkout_form_invalid: [],
  checkout_loyalty_amount_select: [],
  checkout_loyalty_close: [],
  checkout_loyalty_club_open: [],
  checkout_loyalty_disable: [],
  checkout_loyalty_edit_close: [],
  checkout_loyalty_edit_open: [],
  checkout_loyalty_enable: [],
  checkout_loyalty_login: [],
  checkout_loyalty_max_select: [],
  checkout_loyalty_open: [],
  checkout_offer_accept: [],
  checkout_offer_open: [],
  checkout_offer_uncheck: [],
  checkout_submit: [],
  checkout_submit_click: [],
  checkout_success_catalog_open: [],
  checkout_success_support_open: [],
  checkout_tracking_copy: [],
  checkout_tracking_open: [],
  club_account_open: [],
  club_enroll_error: [],
  club_enroll_request: [],
  club_enroll_success: [],
  club_login_request: [],
  club_operations_next: [],
  club_operations_previous: [],
  club_terms_open: [],
  club_workshop_open: [],
  contest_view: ["contest_slug"],
  contest_entry_start: ["contest_slug"],
  contest_entry_submit_success: ["contest_slug"],
  delivery_method_select: ["delivery_provider"],
  payment_method_select: ["payment_method"],
  payment_recovery_error: [],
  payment_recovery_redirect: [],
  payment_recovery_request: [],
  payment_redirect: [],
  payment_return_failure: [],
  payment_return_guest: [],
  payment_return_owner: [],
  pickup_cities_retry: [],
  pickup_city_close: [],
  pickup_city_open: [],
  pickup_city_retry: [],
  pickup_city_select: [],
  pickup_list_close: [],
  pickup_list_open: [],
  pickup_picker_dismiss: [],
  pickup_picker_open: [],
  pickup_point_confirm: ["delivery_provider"],
  pickup_point_confirm_error: [],
  pickup_point_confirm_request: [],
  pickup_point_list_select: [],
  pickup_point_map_select: [],
  pickup_points_retry: [],
  pickup_provider_change: ["delivery_provider"],
  product_cart_open: ["product_id"],
  product_characteristics_jump: [],
  product_community_jump: [],
  product_instructions_open: [],
  product_ozon_reviews_open: [],
  product_quantity_decrease: ["product_id"],
  product_quantity_increase: ["product_id"],
  product_reviews_open: [],
  product_wildberries_reviews_open: [],
  product_works_gallery_open: [],
  product_works_retry: [],
  promo_apply_error: [],
  promo_apply_request: [],
  promo_close: [],
  promo_edit: [],
  promo_login_request: [],
  promo_open: [],
  promo_remove: [],
  promo_replace_request: [],
  work_editor_custom_material_add: [],
  work_editor_mapping_assign: [],
  work_editor_mapping_clear: [],
  work_editor_mapping_close: [],
  work_editor_mapping_open: [],
  work_editor_marker_clear: [],
  work_editor_marker_select: [],
  work_editor_material_remove: [],
  work_editor_material_type_change: [],
  work_editor_materials_close: [],
  work_editor_materials_open: [],
  work_editor_photo_select: [],
  work_editor_retry: [],
  work_editor_save_error: [],
  work_editor_save_request: [],
  work_editor_save_success: [],
  work_editor_saved_material_add: [],
  work_editor_step_next: [],
  work_editor_step_previous: [],
  work_editor_step_select: [],
  work_editor_tool_save_error: [],
  work_editor_tool_save_success: [],
  work_editor_validation_error: [],
  workshop_add_collection_dismiss: [],
  workshop_add_collection_error: [],
  workshop_add_collection_open: [],
  workshop_add_collection_request: [],
  workshop_add_collection_select: [],
  workshop_add_collection_success: [],
  workshop_collection_back: [],
  workshop_collection_open: [],
  workshop_collection_retry: [],
  workshop_delete_dismiss: [],
  workshop_delete_error: [],
  workshop_delete_open: [],
  workshop_delete_request: [],
  workshop_delete_success: [],
  workshop_editor_open: [],
  workshop_public_open: [],
  workshop_public_work_open: [],
  workshop_publish_dismiss: [],
  workshop_publish_error: [],
  workshop_publish_open: [],
  workshop_publish_request: [],
  workshop_publish_success: [],
  workshop_retry: [],
  workshop_unpublish_dismiss: [],
  workshop_unpublish_error: [],
  workshop_unpublish_open: [],
  workshop_unpublish_request: [],
  workshop_unpublish_success: [],
  workshop_visibility_dismiss: [],
  workshop_visibility_error: [],
  workshop_visibility_open: [],
  workshop_visibility_private: [],
  workshop_visibility_public: [],
  workshop_visibility_request: [],
} as const;

export const namedSiteGoalParamKeys = {
  digital_catalog_link_click: ["source"],
  digital_collection_link_click: ["source", "collection_slug"],
  digital_picture_link_click: ["source", ...pictureContext],
  digital_collection_cover_view: ["collection_slug"],
  digital_catalog_retry: [],
  digital_collection_retry: ["collection_slug"],
  digital_picture_retry: pictureContext,
  digital_picture_thumbnail_view: pictureContext,
  digital_picture_image_view: pictureContext,
  digital_palette_selected: [...pictureContext, "palette_id"],
  digital_compare_open: pictureContext,
  digital_compare_close: pictureContext,
  digital_compare_moved: [...pictureContext, "percent"],
  digital_show_left: pictureContext,
  digital_show_right: pictureContext,
  digital_image_retry: pictureContext,
  digital_print_album_click: ["collection_slug", "product_id"],
  digital_material_product_click: [...pictureContext, "product_id"],
  gallery_photo_view: ["work_id"],
  product_photo_view: ["product_id", "position", "mode"],
  product_gallery_open: ["product_id", "position"],
  product_gallery_close: ["product_id", "position"],
  product_photo_select: ["product_id", "position", "mode"],
  gallery_photo_open: ["work_id"],
  gallery_photo_close: ["work_id"],
  blog_image_view: ["article_slug", "image_id"],
  blog_link_copied: ["article_slug"],
  blog_telegram_share_click: ["article_slug"],
  gallery_link_copied: ["work_id"],
  gallery_work_shared: ["work_id"],
  like_added: ["subject_type"],
  like_removed: ["subject_type"],
} as const;

export type NamedSiteGoalId = keyof typeof namedSiteGoalParamKeys;
export const namedSiteGoalIds = Object.keys(namedSiteGoalParamKeys) as NamedSiteGoalId[];

export type InteractionEventId = keyof typeof interactionEventParamKeys;

export type InteractionEventParams = {
  [Id in InteractionEventId]: Pick<NamedSiteFields, (typeof interactionEventParamKeys)[Id][number]>;
};

type NamedSiteFields = {
  sort: "featured" | "newest" | "price-asc" | "price-desc";
  catalog_category: "all" | "colorings" | "markers";
  filter_kind: "minimum_price" | "maximum_price" | "availability" | "bestsellers" | "tag";
  delivery_provider: "ozon" | "cdek";
  payment_method: "tbank_acquiring" | "ozon_acquiring";
  landing_slug: string;
  source: "header" | "mobile_menu" | "footer" | "home" | "product" | "gallery" | "digital";
  collection_slug: string;
  contest_slug: string;
  coloring_number: number;
  palette_id: string;
  percent: number;
  work_id: string;
  product_id: string;
  position: number;
  mode: "carousel" | "lightbox";
  article_slug: string;
  image_id: string;
  subject_type: "community-work" | "blog-post";
};
type NamedSiteGoalParams = {
  [Id in NamedSiteGoalId]: Pick<NamedSiteFields, (typeof namedSiteGoalParamKeys)[Id][number]>;
};

export const yandexGoalEventIds = [
  "product_view",
  "add_to_cart",
  "begin_checkout",
  "promo_apply_success",
  "welcome_promo_click",
  "sign_up",
  "partner_cta_click",
  "partner_form_start",
  "partner_form_success",
  "partner_form_error",
  "digital_versions_opened",
  "digital_coloring_open",
  "site_navigation",
  "site_scroll_depth",
  "site_interaction",
  "feedback_submit_success",
  ...namedSiteGoalIds,
] as const;

export type YandexGoalEventId = (typeof yandexGoalEventIds)[number];

type RubCurrency = "RUB";
type EmptyAnalyticsParams = { readonly [key: string]: never };

export const siteSections = [
  "home",
  "catalog",
  "product",
  "cart",
  "checkout",
  "digital",
  "gallery",
  "club",
  "blog",
  "article",
  "account",
  "auth",
  "help",
  "legal",
  "partners",
  "wholesale",
  "marketplace_ozon",
  "marketplace_wildberries",
  "telegram",
] as const;
export const siteAreas = ["header", "mobile_menu", "footer", "content"] as const;
export const siteActions = [
  "gallery_load_more",
  "gallery_album_open",
  "blog_contents_open",
  "blog_catalog_open",
  "faq_answer_open",
  "gallery_filters_open",
  "gallery_filters_reset",
] as const;

export type YandexGoalParams = NamedSiteGoalParams & {
  feedback_submit_success: { form: "contact" | "wholesale" };
  site_navigation: {
    from_section: (typeof siteSections)[number];
    to_section: (typeof siteSections)[number];
    placement: (typeof siteAreas)[number];
  };
  site_scroll_depth: {
    section: (typeof siteSections)[number];
    percent: 25 | 50 | 75 | 100;
  };
  site_interaction: {
    section: (typeof siteSections)[number];
    action: (typeof siteActions)[number];
  };
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
  partner_cta_click: EmptyAnalyticsParams;
  partner_form_start: EmptyAnalyticsParams;
  partner_form_success: EmptyAnalyticsParams;
  partner_form_error: EmptyAnalyticsParams;
  digital_versions_opened: {
    collection_slug?: string;
  };
  digital_coloring_open: {
    collection_slug: string;
    coloring_number: number;
  };
};

export const diagnosticEventNames = [
  "welcome_promo_dismiss",
  "digital_open_from_product",
  "account_recovery_requested",
  "order_activation_completed",
] as const;

export type DiagnosticEventName = (typeof diagnosticEventNames)[number];

export type DiagnosticEventParams = {
  welcome_promo_dismiss: {
    reason?: "close" | "not_now" | "navigation";
  };
  digital_open_from_product: {
    product_id: string;
    collection_slug: string;
  };
  account_recovery_requested: EmptyAnalyticsParams;
  order_activation_completed: EmptyAnalyticsParams;
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
  "impressions",
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
  impressions: ProductActionPayload;
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

export type InteractionCommand<EventId extends InteractionEventId = InteractionEventId> =
  EventId extends InteractionEventId
    ? {
        kind: "interaction";
        eventId: EventId;
        params: InteractionEventParams[EventId];
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

export type AnalyticsCommand =
  | GoalCommand
  | InteractionCommand
  | DiagnosticCommand
  | EcommerceCommand;

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
