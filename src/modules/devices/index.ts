/**
 * Public API for Devices Module
 */

// Domain Models
export { DeviceKeyStatus, type IDeviceKey } from './domain/models/device-key.model';
export { type IDeviceRegistration } from './domain/models/device-registration.model';
export {
  KeyRotationReason,
  type IKeyRotationRecord,
} from './domain/models/key-rotation.model';

// Domain Ports
export { type IDeviceRepository } from './domain/ports/device-repository.port';
export { type IKeyRotationPort } from './domain/ports/key-rotation.port';
export {
  type IEcdhCryptoPort,
  type KeyPairResult,
  type ValidatePublicKeyResult,
} from './domain/ports/ecdh-crypto.port';
export { type IVaultKeyStorage } from './domain/ports/vault-key-storage.port';
export { type IDeviceKeyExchange } from './domain/ports/device-key-exchange.port';

// Domain Events
export { DeviceRegisteredEvent } from './domain/events/device-registered.event';
export { KeyRotatedEvent } from './domain/events/key-rotated.event';
export { KeyRevokedEvent } from './domain/events/key-revoked.event';

// Domain Constants
export { DEVICE_KEY_CONSTANTS } from './domain/constants/device-key.constants';

// DTOs
export { DeviceKeyExchangeRequestDto } from './dto/device-key-exchange-request.dto';
export { DeviceKeyExchangeResponseDto } from './dto/device-key-exchange-response.dto';
export { DeviceKeyRotationRequestDto } from './dto/device-key-rotation-request.dto';
export { DeviceInfoDto } from './dto/device-info.dto';
export { KeyRotationHistoryDto } from './dto/key-rotation-history.dto';

// Services (Application)
export { DeviceKeyExchangeService } from './application/device-key-exchange.service';
export { DeviceKeyRotationService } from './application/device-key-rotation.service';
export { DeviceKeyRevocationService } from './application/device-key-revocation.service';

// Module
export { DevicesModule } from './devices.module';
