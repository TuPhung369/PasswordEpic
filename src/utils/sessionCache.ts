// Session-based caching for performance optimization
interface SessionCache<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

class SessionCacheManager {
  private cache = new Map<string, SessionCache<any>>();

  set<T>(key: string, value: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.value as T;
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export const sessionCache = new SessionCacheManager();

// Auto cleanup every 5 minutes
setInterval(() => {
  sessionCache.cleanup();
}, 5 * 60 * 1000);
