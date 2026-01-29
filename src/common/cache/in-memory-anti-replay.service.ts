import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IAntiReplayCache } from '../interfaces/anti-replay-cache.interface';

/**
 * In-memory anti-replay cache for JTI (JWT ID) tracking.
 * Prevents token replay by caching used JTIs until their expiration.
 * Periodically cleans up expired entries.
 */
@Injectable()
export class InMemoryAntiReplayCacheService
  implements IAntiReplayCache, OnModuleInit
{
  private readonly logger = new Logger(InMemoryAntiReplayCacheService.name);
  private readonly cache = new Map<string, Date>();

  onModuleInit() {
    this.logger.log('Anti-replay cache initialized');
  }

  async has(jti: string): Promise<boolean> {
    const expiresAt = this.cache.get(jti);
    if (!expiresAt) {
      return false;
    }

    // Check if still valid
    if (Date.now() > expiresAt.getTime()) {
      this.cache.delete(jti);
      return false;
    }

    return true;
  }

  async add(jti: string, expiresAt: Date): Promise<void> {
    this.cache.set(jti, expiresAt);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanup(): Promise<void> {
    const now = new Date();
    let removed = 0;

    for (const [jti, expiresAt] of this.cache.entries()) {
      if (expiresAt < now) {
        this.cache.delete(jti);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.log(
        `Cleaned up ${removed} expired JTIs from anti-replay cache`,
      );
    }
  }
}
