export function scheduleIdlePreload(load: () => Promise<unknown>) {
  let idleId: number | undefined;
  let timeoutId: number | undefined;
  const preload = () => void load().catch(() => undefined);
  // Called after hydration. Third-party resources must not delay preparing the viewer.
  if (typeof window.requestIdleCallback === "function") {
    idleId = window.requestIdleCallback(preload, { timeout: 1000 });
  } else {
    timeoutId = window.setTimeout(preload, 200);
  }

  return () => {
    if (idleId !== undefined) window.cancelIdleCallback(idleId);
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  };
}
