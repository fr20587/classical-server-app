/**
 * Domain Event: DeviceRegisteredEvent
 * 
 * Emitido cuando un dispositivo registra exitosamente sus claves ECDH.
 */

import { BaseDomainEvent } from 'src/common/events/base-domain.event';

export class DeviceRegisteredEvent extends BaseDomainEvent {
  constructor(
    public readonly deviceId: string,
    public readonly userId: string,
    public readonly keyHandle: string,
    public readonly platform: 'android' | 'ios',
    public readonly registeredAt: Date,
  ) {
    super();
  }
}
