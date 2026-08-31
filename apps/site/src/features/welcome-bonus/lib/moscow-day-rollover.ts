import { getMoscowDayKey, getMsUntilNextMoscowDay } from "./moscow-day";

type MoscowDayRolloverOptions = {
  cancel: (_handle: unknown) => void;
  now: () => number;
  onDayChange: (_dayKey: string) => void;
  schedule: (_callback: () => void, _delay: number) => unknown;
};

export function createMoscowDayRollover({
  cancel,
  now,
  onDayChange,
  schedule,
}: MoscowDayRolloverOptions) {
  let currentDay: string | undefined;
  let handle: unknown;

  function clearTimer() {
    if (handle === undefined) {
      return;
    }

    cancel(handle);
    handle = undefined;
  }

  function sync() {
    clearTimer();
    const timestamp = now();
    const nextDay = getMoscowDayKey(timestamp);

    if (nextDay !== currentDay) {
      currentDay = nextDay;
      onDayChange(nextDay);
    }

    handle = schedule(() => {
      handle = undefined;
      sync();
    }, getMsUntilNextMoscowDay(timestamp));
  }

  return { dispose: clearTimer, sync };
}
