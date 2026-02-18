/**
 * Domain Event: KeyRevokedEvent
 * 
 * Emitido cuando una clave ECDH es revocada (invalidada).
 */

import { BaseDomainEvent } from 'src/common/events/base-domain.event';

export class KeyRevokedEvent extends BaseDomainEvent {
  constructor(
    public readonly deviceId: string,
    public readonly userId: string,
    public readonly keyHandle: string,
    public readonly reason: string,
    public readonly revokedAt: Date,
  ) {
    super();
  }
}
