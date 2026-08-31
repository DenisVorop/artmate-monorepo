type ForegroundTimerOptions = {
  cancel: (_handle: unknown) => void;
  durationMs: number;
  now: () => number;
  onElapsed: () => void;
  schedule: (_callback: () => void, _delay: number) => unknown;
};

export function createForegroundTimer({
  cancel,
  durationMs,
  now,
  onElapsed,
  schedule,
}: ForegroundTimerOptions) {
  let completed = false;
  let handle: unknown;
  let remainingMs = durationMs;
  let resumedAt = 0;

  function pause() {
    if (handle === undefined || completed) {
      return;
    }

    cancel(handle);
    handle = undefined;
    remainingMs = Math.max(0, remainingMs - (now() - resumedAt));
  }

  function resume() {
    if (handle !== undefined || completed) {
      return;
    }

    resumedAt = now();
    handle = schedule(() => {
      handle = undefined;
      remainingMs = 0;
      completed = true;
      onElapsed();
    }, remainingMs);
  }

  return { pause, resume };
}
