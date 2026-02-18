/**
 * Injection tokens for device module dependency injection
 * Aligns with NestJS DI system for interface-based contracts
 */

export const DEVICE_INJECTION_TOKENS = {
  DEVICE_REPOSITORY: 'IDeviceRepository',
  KEY_ROTATION_PORT: 'IKeyRotationPort',
  ECDH_CRYPTO_PORT: 'IEcdhCryptoPort',
  VAULT_KEY_STORAGE: 'IVaultKeyStorage',
} as const;
