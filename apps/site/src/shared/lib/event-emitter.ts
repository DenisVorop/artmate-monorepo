type EventHandler = (..._args: never[]) => unknown;

export class EventEmitter<T extends Record<keyof T, EventHandler>> {
  private listeners: {
    [K in keyof T]?: Set<T[K]>;
  } = {};

  on<E extends keyof T>(event: E, listener: T[E]): () => void {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event]?.add(listener);

    return () => {
      this.off(event, listener);
    };
  }

  off<E extends keyof T>(event: E, listener: T[E]): void {
    this.listeners[event]?.delete(listener);
  }

  emit<E extends keyof T>(event: E, ...args: Parameters<T[E]>): void {
    this.listeners[event]?.forEach((listener) => listener(...args));
  }

  async emitAsync<E extends keyof T>(event: E, ...args: Parameters<T[E]>): Promise<void> {
    const handlers = Array.from(this.listeners[event] ?? []);

    for (const handler of handlers) {
      await handler(...args);
    }
  }

  clear(): void {
    this.listeners = {};
  }
}
