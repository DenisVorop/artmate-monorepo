import { Injectable } from "@nestjs/common";

import { providerResponseCacheMaxEntries } from "./delivery.constants";

type CacheEntry = {
  expiresAt: number;
  value: Promise<unknown>;
};

@Injectable()
export class ProviderResponseCacheService {
  private readonly entries = new Map<string, CacheEntry>();

  getOrSet<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = this.entries.get(key);

    if (cached && cached.expiresAt > now) {
      return cached.value as Promise<T>;
    }

    if (cached) {
      this.entries.delete(key);
    }

    this.removeExpiredEntries(now);

    while (this.entries.size >= providerResponseCacheMaxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;

      if (oldestKey === undefined) {
        break;
      }

      this.entries.delete(oldestKey);
    }

    const value = load();
    const entry: CacheEntry = {
      expiresAt: now + ttlMs,
      value,
    };

    this.entries.set(key, entry);
    void value.catch(() => {
      if (this.entries.get(key) === entry) {
        this.entries.delete(key);
      }
    });

    return value;
  }

  private removeExpiredEntries(now: number) {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}
