export function normalizePromoCodeValue(value: string) {
  return value.trim().replace(/[a-z]/g, (character) => character.toUpperCase());
}

export const promoCodePattern = /^[A-Z0-9_-]{3,40}$/;
export const strictIsoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
