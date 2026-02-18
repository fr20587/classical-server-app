/**
 * Application Service: DeviceKeyExchangeService
 * 
 * Flujo principal de intercambio seguro de claves públicas ECDH P-256.
 * Orquesta la colaboración entre adapters criptográficos, repositorio y Vault.
 */

import { Injectable, Logger, Inject, BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import type { IDeviceRepository } from '../domain/ports/device-repository.port';
import type { IEcdhCryptoPort } from '../domain/ports/ecdh-crypto.port';
import type { IVaultKeyStorage } from '../domain/ports/vault-key-storage.port';
import type { IKeyRotationPort } from '../domain/ports/key-rotation.port';

import { DEVICE_INJECTION_TOKENS } from '../domain/constants/device-injection-tokens';

import { DeviceKeyExchangeRequestDto } from '../dto/device-key-exchange-request.dto';
import { DeviceKeyExchangeResponseDto } from '../dto/device-key-exchange-response.dto';

import { DeviceKeyStatus, DeviceKeyModel } from '../domain/models/device-key.model';
import { KeyRotationReason } from '../domain/models/key-rotation.model';

import { DEVICE_KEY_CONSTANTS } from '../domain/constants/device-key.constants';

import { DeviceRegisteredEvent } from '../domain/events/device-registered.event';
import { KeyRotatedEvent } from '../domain/events/key-rotated.event';

@Injectable()
export class DeviceKeyExchangeService {
  private readonly logger = new Logger(DeviceKeyExchangeService.name);

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
  ) {}

  /**
   * Flujo principal: Intercambio de claves públicas ECDH P-256
   * 
   * Pasos:
   * 1. Valida el usuario y la solicitud
   * 2. Valida la clave pública del dispositivo
   * 3. Si deviceId existe → inicia rotación (asignando nuevo keyHandle)
   * 4. Genera par de claves del servidor (o recupera si existe pareja)
   * 5. Calcula shared_secret via ECDH
   * 6. Genera salt único
   * 7. Almacena clave privada en Vault
   * 8. Persiste metadatos en MongoDB
   * 9. Emite eventos para auditoría
   * 10. Retorna serverPublicKey + salt para HKDF en dispositivo
   */
  async exchangePublicKeyWithDevice(
    userId: string,
    request: DeviceKeyExchangeRequestDto,
  ): Promise<DeviceKeyExchangeResponseDto> {
    try {
      this.logger.log(`Starting key exchange | userId: ${userId} | deviceId: ${request.device_id}`);

      // 1. Validar usuario está autenticado
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }

      // 2. Validar clave pública del dispositivo
      const publicKeyValidation = await this.ecdhCrypto.validatePublicKey(
        request.device_public_key,
      );

      if (!publicKeyValidation.isValid) {
        throw new BadRequestException(
          `Invalid device public key: ${publicKeyValidation.reason}`,
        );
      }

      // 3. Verificar límite de dispositivos por usuario
      const activeDeviceCount = await this.deviceRepository.countActiveDevicesByUserId(userId);

      if (activeDeviceCount >= DEVICE_KEY_CONSTANTS.MAX_DEVICES_PER_USER) {
        throw new ConflictException(
          `Maximum number of active devices (${DEVICE_KEY_CONSTANTS.MAX_DEVICES_PER_USER}) reached`,
        );
      }

      // 4. Verificar si dispositivo ya existe
      let previousKeyHandle: string | undefined;
      const existingDevice = await this.deviceRepository.findByDeviceId(request.device_id);

      if (existingDevice) {
        // Rotación de clave detectada
        this.logger.log(
          `Device already registered, rotating key | deviceId: ${request.device_id} | old keyHandle: ${existingDevice.keyHandle}`,
        );
        previousKeyHandle = existingDevice.keyHandle;
      }

      // 5. Generar par de claves del servidor
      const serverKeyPair = await this.ecdhCrypto.generateKeyPair();

      // 6. Calcular shared_secret
      const sharedSecret = await this.ecdhCrypto.deriveSharedSecret(
        request.device_public_key,
        serverKeyPair.privateKeyPem,
      );

      // 7. Generar salt único
      const salt = await this.ecdhCrypto.generateSalt(DEVICE_KEY_CONSTANTS.SALT_LENGTH_BYTES);

      // 8. Generar key_handle opaco
      const keyHandle = await this.ecdhCrypto.generateKeyHandle(DEVICE_KEY_CONSTANTS.KEY_HANDLE_LENGTH);

      // 9. Almacenar clave privada en Vault
      await this.vaultStorage.storeServerPrivateKey(keyHandle, serverKeyPair.privateKeyPem);

      // 10. Calcular fechas de validez
      const issuedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + DEVICE_KEY_CONSTANTS.KEY_VALIDITY_DAYS);

      // 11. Marcar clave anterior como ROTATED (si existía)
      if (previousKeyHandle && existingDevice) {
        await this.deviceRepository.updateStatus(
          existingDevice.id,
          DeviceKeyStatus.ROTATED,
        );

        // Registrar en historial
        await this.rotationRepository.recordRotation({
          deviceId: request.device_id,
          userId,
          previousKeyHandle,
          newKeyHandle: keyHandle,
          reason: KeyRotationReason.MANUAL,
          initiatedBy: userId,
          rotatedAt: new Date(),
        });
      }

      // 12. Persistir nueva clave en MongoDB
      const newDeviceKey = await this.deviceRepository.create({
        deviceId: request.device_id,
        userId,
        keyHandle,
        devicePublicKey: request.device_public_key,
        serverPublicKey: serverKeyPair.publicKeyBase64,
        saltHex: salt.toString('base64'),
        status: DeviceKeyStatus.ACTIVE,
        issuedAt,
        expiresAt,
        platform: request.platform,
        appVersion: request.app_version,
        deviceName: request.device_name,
      });

      // 13. Emitir evento para auditoría
      this.eventEmitter.emit(
        'device.registered',
        new DeviceRegisteredEvent(
          request.device_id,
          userId,
          keyHandle,
          request.platform,
          issuedAt,
        ),
      );

      if (previousKeyHandle) {
        this.eventEmitter.emit(
          'device.key.rotated',
          new KeyRotatedEvent(
            request.device_id,
            userId,
            previousKeyHandle,
            keyHandle,
            KeyRotationReason.MANUAL,
            new Date(),
          ),
        );
      }

      // 14. Construir respuesta
      const daysUntilExpiration = Math.floor(
        (expiresAt.getTime() - issuedAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      const response: DeviceKeyExchangeResponseDto = {
        server_public_key: serverKeyPair.publicKeyBase64,
        key_handle: keyHandle,
        salt: salt.toString('base64'),
        issued_at: issuedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        protocol_version: DEVICE_KEY_CONSTANTS.E2E_PROTOCOL_VERSION,
        days_until_expiration: daysUntilExpiration,
      };

      this.logger.log(
        `Key exchange completed successfully | deviceId: ${request.device_id} | keyHandle: ${keyHandle} | ${previousKeyHandle ? 'ROTATED' : 'NEW'}`,
      );

      return response;
    } catch (error: any) {
      this.logger.error(`Key exchange failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
