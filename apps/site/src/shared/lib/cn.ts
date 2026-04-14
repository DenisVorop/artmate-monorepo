export type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

const toClassName = (value: ClassValue): string => {
  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(toClassName).filter(Boolean).join(" ");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, isEnabled]) => Boolean(isEnabled))
      .map(([className]) => className)
      .join(" ");
  }

  return String(value);
};

export function cn(...values: ClassValue[]) {
  return values.map(toClassName).filter(Boolean).join(" ");
}
