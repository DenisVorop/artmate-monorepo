/** Artmate's server-owned Ozon pickup delivery tariff in rubles. */
export const ozonDeliveryPriceRub = 100;

/** Bounds cached provider responses while retaining useful storefront searches. */
export const providerResponseCacheMaxEntries = 500;
export const cdekCitySearchCacheTtlMs = 30 * 60_000;
export const cdekPickupPointsCacheTtlMs = 10 * 60_000;

/** Matches the persisted order pickup-point snapshot columns. */
export const deliveryPickupPointIdMaxLength = 160;
export const deliveryPickupPointTitleMaxLength = 180;
export const deliveryPickupPointWorkHoursMaxLength = 120;

/** One minute keeps normal map movement responsive while bounding proxy abuse. */
export const ozonProxyThrottleWindowMs = 60_000;
/** Allows shared networks more traffic than an individual browser session. */
export const ozonProxyIpMaxRequests = 120;
/** Supports map pan/zoom bursts without allowing an unbounded storefront proxy. */
export const ozonProxySessionMaxRequests = 60;
