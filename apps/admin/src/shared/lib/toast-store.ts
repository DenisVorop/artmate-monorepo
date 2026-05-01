export type ToastVariant = "success" | "error";

export type ToastItem = {
  readonly description?: string;
  readonly id: string;
  readonly title: string;
  readonly variant: ToastVariant;
};

type ToastInput = {
  readonly description?: string;
  readonly durationMs?: number;
  readonly title: string;
  readonly variant?: ToastVariant;
};

const maxToasts = 5;
const defaultToastDurationMs = 5000;

let toastCounter = 0;
let toasts: readonly ToastItem[] = [];
const listeners = new Set<() => void>();
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export function showToast({
  description,
  durationMs = defaultToastDurationMs,
  title,
  variant = "success",
}: ToastInput) {
  const id = `${Date.now()}-${toastCounter}`;
  toastCounter += 1;

  toasts = [{ description, id, title, variant }, ...toasts].slice(0, maxToasts);
  emitToastChange();

  const timeout = setTimeout(() => dismissToast(id), durationMs);
  toastTimeouts.set(id, timeout);

  return id;
}

export function dismissToast(id: string) {
  const timeout = toastTimeouts.get(id);

  if (timeout) {
    clearTimeout(timeout);
    toastTimeouts.delete(id);
  }

  toasts = toasts.filter((toast) => toast.id !== id);
  emitToastChange();
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function getToastSnapshot() {
  return toasts;
}

function emitToastChange() {
  listeners.forEach((listener) => listener());
}
