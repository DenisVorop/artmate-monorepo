/** Artmate's server-owned Ozon pickup delivery tariff in rubles. */
export const ozonDeliveryPriceRub = 200;

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
