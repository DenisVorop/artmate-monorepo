export function schedulePreviewPreload(load: () => Promise<unknown>) {
  let idleId: number | undefined;
  let timeoutId: number | undefined;
  const preload = () => void load().catch(() => undefined);
  const schedule = () => {
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(preload, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(preload, 200);
    }
  };

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });

  return () => {
    window.removeEventListener("load", schedule);
    if (idleId !== undefined) window.cancelIdleCallback(idleId);
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  };
}
