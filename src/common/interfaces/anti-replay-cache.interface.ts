/**
 * Anti-replay cache interface for JTI (JWT ID) tracking.
 * Prevents token replay attacks by caching used JTIs until expiration.
 */
export interface IAntiReplayCache {
  /**
   * Check if a JTI has been used
   */
  has(jti: string): Promise<boolean>;

  /**
   * Add a JTI to the cache with expiration date
   */
  add(jti: string, expiresAt: Date): Promise<void>;

  /**
   * Clean up expired JTIs from cache
   */
  cleanup(): Promise<void>;
}
