export function objectEntries<T extends object>(value: T) {
  return Object.entries(value) as Array<[keyof T, T[keyof T]]>;
}
