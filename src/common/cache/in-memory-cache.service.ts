import { Injectable, Logger } from '@nestjs/common';
import { ICacheService } from '../interfaces/cache.interface';

/**
 * Cache entry with expiration timestamp
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory cache implementation using Map with TTL support.
 * Suitable for single-instance deployments.
 */
@Injectable()
export class InMemoryCacheService implements ICacheService {
  private readonly logger = new Logger(InMemoryCacheService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}
