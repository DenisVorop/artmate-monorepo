import type { AnalyticsCommand, AnalyticsDedupeScope } from "./types";

const dedupeKeyPrefix = "artmate:analytics:v1";
const sentKeys = new Set<string>();

export function wasAnalyticsCommandSent(command: AnalyticsCommand) {
  const key = getDedupeKey(command);

  if (!key) {
    return false;
  }

  if (sentKeys.has(key)) {
    return true;
  }

  if (command.dedupe?.scope === "memory") {
    return false;
  }

  const storage = command.dedupe ? getStorage(command.dedupe.scope) : null;

  if (!storage) {
    return false;
  }

  try {
    if (storage.getItem(key) !== null) {
      sentKeys.add(key);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function markAnalyticsCommandSent(command: AnalyticsCommand) {
  const key = getDedupeKey(command);

  if (!key) {
    return;
  }

  sentKeys.add(key);

  if (command.dedupe?.scope === "memory") {
    return;
  }

  const storage = command.dedupe ? getStorage(command.dedupe.scope) : null;

  try {
    storage?.setItem(key, "1");
  } catch {
    // In-memory dedupe remains available when browser storage is blocked.
  }
}

function getDedupeKey(command: AnalyticsCommand) {
  if (!command.dedupe) {
    return null;
  }

  const entityKey = command.dedupe.entityKey.trim();

  if (!entityKey) {
    return null;
  }

  return [dedupeKeyPrefix, command.kind, getCommandName(command), entityKey].join(":");
}

function getCommandName(command: AnalyticsCommand) {
  switch (command.kind) {
    case "goal":
      return command.eventId;
    case "diagnostic":
      return command.event;
    case "ecommerce":
      return command.action;
  }
}

function getStorage(scope: Exclude<AnalyticsDedupeScope, "memory">) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return scope === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}
