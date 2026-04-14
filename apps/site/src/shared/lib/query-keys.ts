export type QueryKeyPart = string | number | boolean | null | undefined;

export function createQueryKey(...parts: QueryKeyPart[]) {
  return parts.filter((part) => part !== null && part !== undefined);
}
