/**
 * Injection tokens for dependency injection across the application.
 * Used for interface-based dependencies and multi-implementation providers.
 */
export const INJECTION_TOKENS = {
  // Cache
  CACHE_SERVICE: Symbol('CACHE_SERVICE'),
  ANTI_REPLAY_CACHE: Symbol('ANTI_REPLAY_CACHE'),

  // Vault
  VAULT_CLIENT: Symbol('VAULT_CLIENT'),

  // Authz
  AUTHZ_SERVICE: Symbol('AUTHZ_SERVICE'),

  // Auth
  AUTH_SERVICE: Symbol('AUTH_SERVICE'),

  // Admin
  ADMIN_SERVICE: Symbol('ADMIN_SERVICE'),

  // Audit
  AUDIT_SERVICE: Symbol('AUDIT_SERVICE'),

  // Repositories
  USER_REPOSITORY: Symbol('USER_REPOSITORY'),
  ROLE_REPOSITORY: Symbol('ROLE_REPOSITORY'),
  PERMISSION_REPOSITORY: Symbol('PERMISSION_REPOSITORY'),
  SERVICE_REPOSITORY: Symbol('SERVICE_REPOSITORY'),
  TERMINAL_REPOSITORY: Symbol('TERMINAL_REPOSITORY'),
  KEY_REPOSITORY: Symbol('KEY_REPOSITORY'),

  // Providers
  JWKS_PROVIDER: Symbol('JWKS_PROVIDER'),
  DUKPT_PROVIDER: Symbol('DUKPT_PROVIDER'),

  // KMS - Keys Module
  BDK_PROVIDER: Symbol('BDK_PROVIDER'),
  DUKPT_DERIVER: Symbol('DUKPT_DERIVER'),
  PIN_BLOCK_TRANSLATOR: Symbol('PIN_BLOCK_TRANSLATOR'),
  ZPK_PROVIDER: Symbol('ZPK_PROVIDER'),
  RATE_LIMIT_SERVICE: Symbol('RATE_LIMIT_SERVICE'),
  SECURE_BUFFER_ADAPTER: Symbol('SECURE_BUFFER_ADAPTER'),
};

