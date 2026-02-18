/**
 * Application Service: DeviceKeyRevocationService
 * 
 * Revocación de claves (invalidación sin eliminar registro).
 */

import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import type { IDeviceRepository } from '../domain/ports/device-repository.port';
import type { IVaultKeyStorage } from '../domain/ports/vault-key-storage.port';
import type { IKeyRotationPort } from '../domain/ports/key-rotation.port';

import { DEVICE_INJECTION_TOKENS } from '../domain/constants/device-injection-tokens';

import { DeviceKeyStatus } from '../domain/models/device-key.model';
import { KeyRevokedEvent } from '../domain/events/key-revoked.event';

@Injectable()
export class DeviceKeyRevocationService {
  private readonly logger = new Logger(DeviceKeyRevocationService.name);

  constructor(
    @Inject(DEVICE_INJECTION_TOKENS.DEVICE_REPOSITORY)
    private readonly deviceRepository: IDeviceRepository,
    @Inject(DEVICE_INJECTION_TOKENS.VAULT_KEY_STORAGE)
    private readonly vaultStorage: IVaultKeyStorage,
    @Inject(DEVICE_INJECTION_TOKENS.KEY_ROTATION_PORT)
    private readonly rotationRepository: IKeyRotationPort,
    private readonly eventEmitter: EventEmitter2,
  ) {}

    /**
     * Revoca una clave de dispositivo (soft delete)
     */
    async revokeDeviceKey(
        deviceId: string,
        userId: string,
        reason: string = 'Manual revocation',
    ): Promise<void> {
        const deviceKey = await this.deviceRepository.findByDeviceId(deviceId);

        if (!deviceKey || deviceKey.userId !== userId) {
            throw new NotFoundException(`Device not found: ${deviceId}`);
        }

        // Marcar como REVOKED
        await this.deviceRepository.updateStatus(deviceKey.id, DeviceKeyStatus.REVOKED);

        // Opcionalmente, eliminar de Vault
        try {
            await this.vaultStorage.deleteServerPrivateKey(deviceKey.keyHandle);
        } catch (error: any) {
            this.logger.warn(`Could not delete key from Vault: ${error.message}`);
        }

        // Emitir evento
        this.eventEmitter.emit(
            'device.key.revoked',
            new KeyRevokedEvent(
                deviceId,
                userId,
                deviceKey.keyHandle,
                reason,
                new Date(),
            ),
        );

        this.logger.log(`Revoked device key | deviceId: ${deviceId} | userId: ${userId}`);
    }

    /**
     * Revoca todos los dispositivos de un usuario
     */
    async revokeAllDevicesByUserId(userId: string, reason: string): Promise<number> {
        const count = await this.deviceRepository.revokeAllByUserId(userId, reason);

        this.logger.log(`Revoked all devices for user | userId: ${userId} | count: ${count}`);

        return count;
    }
}
