import { randomUUID } from 'crypto';

/**
 * Abstract base class for all domain events.
 * Provides versioning, timestamping, and request tracing.
 */
export abstract class BaseDomainEvent {
  /**
   * Event schema version for versioning support
   */
  public readonly version: number = 1;

  /**
   * Event creation timestamp
   */
  public readonly timestamp: Date;

  /**
   * Unique identifier for this event instance
   */
  public readonly eventId: string;

  /**
   * Request ID for tracing (from AsyncLocalStorage)
   */
  public readonly requestId?: string;

  constructor(requestId?: string) {
    this.timestamp = new Date();
    this.eventId = randomUUID();
    this.requestId = requestId;
  }
}
