const shownDayStorageKey = "artmate_welcome_bonus_shown_moscow_day_v2";
const dismissedDayStorageKey = "artmate_welcome_bonus_dismissed_moscow_day_v2";

let memoryShownDay: string | undefined;
let memoryDismissedDay: string | undefined;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function wasWelcomeBonusShownToday(dayKey: string, storage?: StorageLike) {
  const resolvedStorage = storage ?? getBrowserStorage("sessionStorage");
  if (!resolvedStorage) {
    return memoryShownDay === dayKey;
  }

  try {
    return memoryShownDay === dayKey || resolvedStorage.getItem(shownDayStorageKey) === dayKey;
  } catch {
    return memoryShownDay === dayKey;
  }
}

export function markWelcomeBonusShownToday(dayKey: string, storage?: StorageLike) {
  memoryShownDay = dayKey;
  const resolvedStorage = storage ?? getBrowserStorage("sessionStorage");
  if (!resolvedStorage) {
    return;
  }

  try {
    resolvedStorage.setItem(shownDayStorageKey, dayKey);
  } catch {
    // The date-scoped in-memory marker remains authoritative for this tab.
  }
}

export function wasWelcomeBonusDismissedToday(dayKey: string, storage?: StorageLike) {
  const resolvedStorage = storage ?? getBrowserStorage("localStorage");
  if (!resolvedStorage) {
    return memoryDismissedDay === dayKey;
  }

  try {
    return (
      memoryDismissedDay === dayKey ||
      resolvedStorage.getItem(dismissedDayStorageKey) === dayKey
    );
  } catch {
    return memoryDismissedDay === dayKey;
  }
}

export function markWelcomeBonusDismissedToday(dayKey: string, storage?: StorageLike) {
  memoryDismissedDay = dayKey;
  const resolvedStorage = storage ?? getBrowserStorage("localStorage");
  if (!resolvedStorage) {
    return;
  }

  try {
    resolvedStorage.setItem(dismissedDayStorageKey, dayKey);
  } catch {
    // The date-scoped in-memory marker remains authoritative for this page lifetime.
  }
}

function getBrowserStorage(name: "localStorage" | "sessionStorage") {
  try {
    return typeof window === "undefined" ? undefined : window[name];
  } catch {
    return undefined;
  }
}
