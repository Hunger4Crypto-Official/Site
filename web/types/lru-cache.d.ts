declare module 'lru-cache' {
  interface LRUCacheOptions<K, V> {
    max?: number;
    ttl?: number;
    allowStale?: boolean;
  }

  interface SetOptions {
    ttl?: number;
  }

  export class LRUCache<K = any, V = any> {
    constructor(options?: LRUCacheOptions<K, V>);
    get(key: K): V | undefined;
    set(key: K, value: V, options?: SetOptions): void;
    delete(key: K): void;
    keys(): IterableIterator<K>;
  }
}
