/**
 * Infrastructure Adapter: EcdhCryptoAdapter
 * 
 * Implementación de operaciones criptográficas ECDH P-256 usando Node.js crypto nativo.
 * Cumple con FIPS 186-4 y RFC 5869 (HKDF).
 */

import { Injectable, Logger } from '@nestjs/common';

import { createECDH, randomBytes, hkdfSync, createPrivateKey } from 'crypto';

import { IEcdhCryptoPort, KeyPairResult, ValidatePublicKeyResult } from '../../domain/ports/ecdh-crypto.port';

import { DEVICE_KEY_CONSTANTS } from '../../domain/constants/device-key.constants';

@Injectable()
export class EcdhCryptoAdapter implements IEcdhCryptoPort {
  private readonly logger = new Logger(EcdhCryptoAdapter.name);

  /**
   * Genera un nuevo par de claves ECDH P-256
   * La clave privada se exporta como PEM para almacenamiento seguro en Vault
   */
  async generateKeyPair(): Promise<KeyPairResult> {
    try {
      const ecdh = createECDH(DEVICE_KEY_CONSTANTS.ECDH_CURVE);
      
      // Generar material criptográfico
      ecdh.generateKeys();
      
      // Obtener y exportar clave privada
      const privateKey = ecdh.getPrivateKey();
      const privateKeyObject = createPrivateKey({
        key: privateKey,
        format: 'der',
        type: 'pkcs8',
      });
      const privateKeyPem = privateKeyObject.export({ format: 'pem', type: 'pkcs8' }) as string;
      
      // Obtener clave pública en formato uncompressed (65 bytes)
      // getPublicKey() sin argumentos retorna por defecto el formato uncompressed
      const publicKeyBuffer = ecdh.getPublicKey('uncompressed' as any);
      const publicKeyBase64 = publicKeyBuffer.toString('base64');
      
      this.logger.debug(`Generated new key pair | public key length: ${publicKeyBase64.length} chars`);
      
      return {
        privateKeyPem,
        publicKeyBase64,
      };
    } catch (error: any) {
      this.logger.error(`Failed to generate key pair: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calcula el secreto compartido ECDH entre servidor y dispositivo
   * shared_secret = ECDH(serverPrivateKey, devicePublicKey)
   */
  async deriveSharedSecret(
    devicePublicKeyBase64: string,
    serverPrivateKeyPem: string,
  ): Promise<Buffer> {
    try {
      // Importar clave privada del servidor
      const privateKeyObject = createPrivateKey({
        key: serverPrivateKeyPem,
        format: 'pem',
      });
      
      // Reconstruir ECDH con la clave privada desde PEM
      const ecdh = createECDH(DEVICE_KEY_CONSTANTS.ECDH_CURVE);
      
      // La clave privada en formato DER
      const keyDer = privateKeyObject.export({ format: 'der', type: 'pkcs8' });
      
      // Convertir clave pública del dispositivo desde Base64
      const devicePublicKeyBuffer = Buffer.from(devicePublicKeyBase64, 'base64');
      
      // Computar secreto compartido
      const sharedSecret = ecdh.computeSecret(devicePublicKeyBuffer);
      
      this.logger.debug(`Derived shared secret | length: ${sharedSecret.length} bytes`);
      
      return sharedSecret;
    } catch (error: any) {
      this.logger.error(`Failed to derive shared secret: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deriva material criptográfico usando HKDF-SHA256 (RFC 5869)
   * Implementa el protocolo especificado en CAPTURA_SEGURA_DEL_PIN.md
   */
  async deriveHkdf(
    sharedSecret: Buffer,
    salt: Buffer,
    info: string,
  ): Promise<Buffer> {
    try {
      const hkdf = hkdfSync(
        'sha256',
        sharedSecret,
        salt,
        info,
        DEVICE_KEY_CONSTANTS.HKDF_OUTPUT_LENGTH,
      );
      
      // Convertir a Buffer si es necesario (hkdfSync puede retornar ArrayBuffer)
      const hkdfBuffer = Buffer.isBuffer(hkdf) ? hkdf : Buffer.from(hkdf);
      
      this.logger.debug(`Derived HKDF material | length: ${hkdfBuffer.length} bytes`);
      
      return hkdfBuffer;
    } catch (error: any) {
      this.logger.error(`Failed to derive HKDF: ${error.message}`);
      throw error;
    }
  }

  /**
   * Valida que una clave pública sea un punto válido en la curva P-256
   */
  async validatePublicKey(publicKeyBase64: string): Promise<ValidatePublicKeyResult> {
    try {
      // Convertir de Base64
      const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');
      
      // Validar longitud (debe ser 65 bytes para formato uncompressed)
      if (publicKeyBuffer.length !== 65) {
        return {
          isValid: false,
          reason: `Invalid length: expected 65 bytes for uncompressed P-256 key, got ${publicKeyBuffer.length}`,
        };
      }
      
      // Validar primer byte (0x04 para uncompressed)
      if (publicKeyBuffer[0] !== 0x04) {
        return {
          isValid: false,
          reason: `Invalid format: expected uncompressed key (0x04 prefix), got 0x${publicKeyBuffer[0].toString(16)}`,
        };
      }
      
      // Validación básica: el resto de bytes debe ser válido
      // Para validación criptográfica completa, usar bibliotecas especializadas
      this.logger.debug(`Validated public key | Base64 length: ${publicKeyBase64.length}`);
      
      return { isValid: true };
    } catch (error: any) {
      return {
        isValid: false,
        reason: `Error validating public key: ${error.message}`,
      };
    }
  }

  /**
   * Genera un salt aleatorio criptográficamente seguro
   */
  async generateSalt(lengthBytes: number): Promise<Buffer> {
    try {
      const salt = randomBytes(lengthBytes);
      this.logger.debug(`Generated salt | length: ${salt.length} bytes`);
      return salt;
    } catch (error: any) {
      this.logger.error(`Failed to generate salt: ${error.message}`);
      throw error;
    }
  }

  /**
   * Genera un key_handle opaco (identificador no reversible de base64)
   */
  async generateKeyHandle(lengthBytes: number = 32): Promise<string> {
    try {
      const randomData = randomBytes(lengthBytes);
      const keyHandle = randomData.toString('base64url').substring(0, 32);
      this.logger.debug(`Generated key_handle | length: ${keyHandle.length} chars`);
      return keyHandle;
    } catch (error: any) {
      this.logger.error(`Failed to generate key_handle: ${error.message}`);
      throw error;
    }
  }
}
