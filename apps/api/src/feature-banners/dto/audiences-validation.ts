import { ValidateBy, type ValidationOptions } from "class-validator";

export function IsFeatureBannerAudienceSelection(
  validationOptions?: ValidationOptions,
) {
  return ValidateBy(
    {
      name: "isFeatureBannerAudienceSelection",
      validator: {
        validate(value: unknown) {
          return (
            Array.isArray(value) &&
            (value.length === 1 || !value.includes("all"))
          );
        },
        defaultMessage() {
          return "audiences must contain all by itself or other audiences without all";
        },
      },
    },
    validationOptions,
  );
}
