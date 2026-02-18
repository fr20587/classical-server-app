/**
 * Domain Event: KeyRotatedEvent
 * 
 * Emitido cuando una clave ECDH es rotada (reemplazada por una nueva).
 */

import { BaseDomainEvent } from 'src/common/events/base-domain.event';
import { KeyRotationReason } from '../models/key-rotation.model';

export class KeyRotatedEvent extends BaseDomainEvent {
  constructor(
    public readonly deviceId: string,
    public readonly userId: string,
    public readonly previousKeyHandle: string,
    public readonly newKeyHandle: string,
    public readonly reason: KeyRotationReason,
    public readonly rotatedAt: Date,
  ) {
    super();
  }
}
