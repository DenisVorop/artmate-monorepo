import { ValidateBy, type ValidationOptions } from "class-validator";

export const yandexAttributionIdentifierPattern = /^[0-9]{1,128}$/;

export function parseYandexAttributionIdentifier(value: unknown) {
  return typeof value === "string" && yandexAttributionIdentifierPattern.test(value)
    ? value
    : undefined;
}

export function parseYandexAttribution(
  value: { clientId?: unknown; yclid?: unknown } | null | undefined,
) {
  const clientId = parseYandexAttributionIdentifier(value?.clientId);
  const yclid = parseYandexAttributionIdentifier(value?.yclid);

  return {
    ...(clientId ? { clientId } : {}),
    ...(yclid ? { yclid } : {}),
  };
}

export function IsYandexAttributionIdentifier(
  validationOptions?: ValidationOptions,
) {
  return ValidateBy(
    {
      name: "isYandexAttributionIdentifier",
      validator: {
        validate: (value) => parseYandexAttributionIdentifier(value) !== undefined,
      },
    },
    validationOptions,
  );
}
