/**
 * Module: DevicesModule
 * 
 * Módulo de gestión de dispositivos con intercambio seguro de claves ECDH P-256.
 * Arquitectura hexagonal con separación clara entre domain, application e infrastructure.
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Schemas
import { DeviceKey, DeviceKeySchema } from './infrastructure/schemas/device-key.schema';
import {
  KeyRotationHistory,
  KeyRotationHistorySchema,
} from './infrastructure/schemas/key-rotation-history.schema';

// Adapters (Infrastructure)
import { DeviceRepository } from './infrastructure/adapters/device.repository';
import { KeyRotationRepository } from './infrastructure/adapters/key-rotation.repository';
import { EcdhCryptoAdapter } from './infrastructure/adapters/ecdh-crypto.adapter';
import { VaultKeyStorageAdapter } from './infrastructure/adapters/vault-key-storage.adapter';

// Services (Application)
import { DeviceKeyExchangeService } from './application/device-key-exchange.service';
import { DeviceKeyRotationService } from './application/device-key-rotation.service';
import { DeviceKeyRevocationService } from './application/device-key-revocation.service';

// Controllers
import { DevicesController } from './infrastructure/controllers/devices.controller';

// Guards & Pipes
import { DeviceOwnershipGuard } from './infrastructure/guards/device-ownership.guard';
import { ValidatePublicKeyPipe } from './infrastructure/pipes/validate-public-key.pipe';

// Common modules
import { VaultModule } from 'src/modules/vault/vault.module';
import { CommonModule } from 'src/common/common.module';
import { DEVICE_INJECTION_TOKENS } from './domain/constants/device-injection-tokens';
import { AsyncContextService } from 'src/common/context';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeviceKey.name, schema: DeviceKeySchema },
      { name: KeyRotationHistory.name, schema: KeyRotationHistorySchema },
    ]),
    VaultModule,
    CommonModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
  ],
  providers: [
    // Adapters - injectar bajo puertos específicos
    {
      provide: DEVICE_INJECTION_TOKENS.DEVICE_REPOSITORY,
      useClass: DeviceRepository,
    },
    {
      provide: DEVICE_INJECTION_TOKENS.KEY_ROTATION_PORT,
      useClass: KeyRotationRepository,
    },
    {
      provide: DEVICE_INJECTION_TOKENS.ECDH_CRYPTO_PORT,
      useClass: EcdhCryptoAdapter,
    },
    {
      provide: DEVICE_INJECTION_TOKENS.VAULT_KEY_STORAGE,
      useClass: VaultKeyStorageAdapter,
    },
    // Application Services
    AsyncContextService,
    DeviceKeyExchangeService,
    DeviceKeyRotationService,
    DeviceKeyRevocationService,
    // Guards & Pipes
    DeviceOwnershipGuard,
    ValidatePublicKeyPipe,
  ],
  controllers: [
    DevicesController,
  ],
  exports: [
    DeviceKeyExchangeService,
    DeviceKeyRotationService,
    DeviceKeyRevocationService,
  ],
})
export class DevicesModule {}
