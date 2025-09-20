import { LRUCache } from 'lru-cache';

type CacheValue = unknown;

type CacheOptions = {
  max?: number;
  ttl?: number;
};

export class ContentCache {
  private cache: LRUCache<string, CacheValue>;

  constructor(options: CacheOptions = {}) {
    this.cache = new LRUCache<string, CacheValue>({
      max: options.max ?? 250,
      ttl: options.ttl ?? 1000 * 60 * 60,
      allowStale: false
    });
  }

  get<T = CacheValue>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined;
  }

  set<T = CacheValue>(key: string, value: T, ttl?: number) {
    this.cache.set(key, value, { ttl });
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  invalidate(pattern: string) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export const contentCache = new ContentCache();
