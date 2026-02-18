/**
 * Application Service: DeviceKeyRotationService
 * 
 * Manejo de rotaciones periódicas y manuales de claves.
 */

import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';

import type { IDeviceRepository } from '../domain/ports/device-repository.port';
import type { IEcdhCryptoPort } from '../domain/ports/ecdh-crypto.port';
import type { IVaultKeyStorage } from '../domain/ports/vault-key-storage.port';
import type { IKeyRotationPort } from '../domain/ports/key-rotation.port';

import { DEVICE_INJECTION_TOKENS } from '../domain/constants/device-injection-tokens';

import { DeviceKeyStatus } from '../domain/models/device-key.model';
import { KeyRotationReason } from '../domain/models/key-rotation.model';

import { KeyRotatedEvent } from '../domain/events/key-rotated.event';

import { DEVICE_KEY_CONSTANTS } from '../domain/constants/device-key.constants';

import { DeviceKeyExchangeResponseDto } from '../dto/device-key-exchange-response.dto';

@Injectable()
export class DeviceKeyRotationService {
    private readonly logger = new Logger(DeviceKeyRotationService.name);

    constructor(
        @Inject(DEVICE_INJECTION_TOKENS.DEVICE_REPOSITORY)
        private readonly deviceRepository: IDeviceRepository,
        @Inject(DEVICE_INJECTION_TOKENS.ECDH_CRYPTO_PORT)
        private readonly ecdhCrypto: IEcdhCryptoPort,
        @Inject(DEVICE_INJECTION_TOKENS.VAULT_KEY_STORAGE)
        private readonly vaultStorage: IVaultKeyStorage,
        @Inject(DEVICE_INJECTION_TOKENS.KEY_ROTATION_PORT)
        private readonly rotationRepository: IKeyRotationPort,
        private readonly eventEmitter: EventEmitter2,
    ) { }


    /**
     * Rotación manual de clave solicitada por el usuario
     */
    async rotateDeviceKey(
        deviceId: string,
        userId: string,
        newDevicePublicKey?: string,
    ): Promise<DeviceKeyExchangeResponseDto> {
        const currentKey = await this.deviceRepository.findByDeviceId(deviceId);

        if (!currentKey || currentKey.userId !== userId) {
            throw new NotFoundException(`Device not found: ${deviceId}`);
        }

        if (await this.rotationRepository.countRotationsIn24Hours(deviceId)) {
            const count = await this.rotationRepository.countRotationsIn24Hours(deviceId);
            if (count >= DEVICE_KEY_CONSTANTS.MAX_ROTATIONS_PER_24H) {
                throw new Error(
                    `Too many rotations in 24 hours. Max: ${DEVICE_KEY_CONSTANTS.MAX_ROTATIONS_PER_24H}`,
                );
            }
        }

        // Generar nueva clave si se proporciona nueva pública del dispositivo
        const devicePublicKeyToUse = newDevicePublicKey || currentKey.devicePublicKey;

        // Generar nuevo par de claves del servidor
        const serverKeyPair = await this.ecdhCrypto.generateKeyPair();
        const salt = await this.ecdhCrypto.generateSalt(DEVICE_KEY_CONSTANTS.SALT_LENGTH_BYTES);
        const keyHandle = await this.ecdhCrypto.generateKeyHandle(DEVICE_KEY_CONSTANTS.KEY_HANDLE_LENGTH);

        // Almacenar nueva clave privada
        await this.vaultStorage.storeServerPrivateKey(keyHandle, serverKeyPair.privateKeyPem);

        // Marcar antigua como ROTATED
        await this.deviceRepository.updateStatus(currentKey.id, DeviceKeyStatus.ROTATED);

        // Registrar rotación
        await this.rotationRepository.recordRotation({
            deviceId,
            userId,
            previousKeyHandle: currentKey.keyHandle,
            newKeyHandle: keyHandle,
            reason: KeyRotationReason.MANUAL,
            initiatedBy: userId,
            rotatedAt: new Date(),
        });

        // Crear nueva entrada
        const issuedAt = new Date();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + DEVICE_KEY_CONSTANTS.KEY_VALIDITY_DAYS);

        await this.deviceRepository.create({
            deviceId,
            userId,
            keyHandle,
            devicePublicKey: devicePublicKeyToUse,
            serverPublicKey: serverKeyPair.publicKeyBase64,
            saltHex: salt.toString('base64'),
            status: DeviceKeyStatus.ACTIVE,
            issuedAt,
            expiresAt,
            platform: currentKey.platform,
            appVersion: currentKey.appVersion,
        });

        // Emitir evento
        this.eventEmitter.emit(
            'device.key.rotated',
            new KeyRotatedEvent(
                deviceId,
                userId,
                currentKey.keyHandle,
                keyHandle,
                KeyRotationReason.MANUAL,
                new Date(),
            ),
        );

        this.logger.log(`Manually rotated device key | deviceId: ${deviceId} | userId: ${userId}`);

        const daysUntilExpiration = DEVICE_KEY_CONSTANTS.KEY_VALIDITY_DAYS;

        return {
            server_public_key: serverKeyPair.publicKeyBase64,
            key_handle: keyHandle,
            salt: salt.toString('base64'),
            issued_at: issuedAt.toISOString(),
            expires_at: expiresAt.toISOString(),
            protocol_version: 'E2E1',
            days_until_expiration: daysUntilExpiration,
        };
    }

    /**
     * Rotación automática periódica de claves cercanas a expiración
     */
    @Cron('0 0 * * 0') // Semanal (domingo a medianoche)
    async handlePeriodicKeyRotation(): Promise<void> {
        try {
            this.logger.log('Starting periodic key rotation job');

            const expiredKeys = await this.deviceRepository.findExpiredKeys(
                -DEVICE_KEY_CONSTANTS.KEY_ROTATION_INTERVAL_DAYS,
            );

            let rotatedCount = 0;

            for (const expiredKey of expiredKeys) {
                try {
                    await this.rotateDeviceKey(expiredKey.deviceId, expiredKey.userId);
                    rotatedCount++;
                } catch (error: any) {
                    this.logger.warn(
                        `Failed to auto-rotate key for device ${expiredKey.deviceId}: ${error.message}`,
                    );
                }
            }

            this.logger.log(`Periodic key rotation completed | rotated: ${rotatedCount}`);
        } catch (error: any) {
            this.logger.error(`Periodic key rotation job failed: ${error.message}`);
        }
    }
}
