import { BadRequestException } from "@nestjs/common";

export type ProductCharacteristic = {
  name: string;
  value: string;
  isHighlighted: boolean;
};

function parsePlainText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new BadRequestException(`${field} must be a string`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength || /[<>]/u.test(trimmed)) {
    throw new BadRequestException(
      `${field} must be plain text up to ${maxLength} characters without angle brackets`,
    );
  }

  return trimmed;
}

export function parseProductCharacteristics(
  value: unknown,
): ProductCharacteristic[] {
  if (!Array.isArray(value) || value.length > 30) {
    throw new BadRequestException(
      "characteristics must be an array of up to 30 items",
    );
  }

  const names = new Set<string>();
  let highlightedCount = 0;

  return value.map((row: unknown, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new BadRequestException(
        `characteristics[${index}] must be an object`,
      );
    }

    const item = row as Record<string, unknown>;
    const name = parsePlainText(
      item.name,
      `characteristics[${index}].name`,
      80,
    );
    const text = parsePlainText(
      item.value,
      `characteristics[${index}].value`,
      500,
    );

    if (!name || !text) {
      throw new BadRequestException(
        "Characteristic name and value must not be empty",
      );
    }

    const normalizedName = name.toLocaleLowerCase("ru-RU");

    if (names.has(normalizedName)) {
      throw new BadRequestException("Characteristic names must be unique");
    }

    names.add(normalizedName);

    if (typeof item.isHighlighted !== "boolean") {
      throw new BadRequestException(
        "Characteristic isHighlighted must be a boolean",
      );
    }

    if (item.isHighlighted && ++highlightedCount > 2) {
      throw new BadRequestException(
        "At most 2 characteristics may be highlighted",
      );
    }

    return { name, value: text, isHighlighted: item.isHighlighted };
  });
}

export function parseProductUsageInstructions(value: unknown) {
  return parsePlainText(value, "usageInstructions", 6000) || null;
}
