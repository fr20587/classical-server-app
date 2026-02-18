/**
 * Domain Port: VaultKeyStorage
 * 
 * Contrato para almacenamiento seguro de claves privadas del servidor en HashiCorp Vault.
 * Las claves privadas NUNCA se almacenan en base de datos; Vault es el único almacén.
 */

export interface IVaultKeyStorage {
  /**
   * Almacena la clave privada del servidor en Vault
   * Ruta: secret/devices/keys/{keyHandle}/private
   *
   * @param keyHandle - Identificador único de la clave
   * @param privatePem - Clave privada en formato PEM
   */
  storeServerPrivateKey(keyHandle: string, privatePem: string): Promise<void>;

  /**
   * Recupera la clave privada del servidor desde Vault
   * Operación de lectura, puede ser cacheada internamente
   *
   * @param keyHandle - Identificador único de la clave
   * @returns Clave privada en formato PEM
   */
  retrieveServerPrivateKey(keyHandle: string): Promise<string>;

  /**
   * Elimina la clave privada de Vault (revocación)
   *
   * @param keyHandle - Identificador único de la clave
   */
  deleteServerPrivateKey(keyHandle: string): Promise<void>;

  /**
   * Verifica que una clave privada existe en Vault
   *
   * @param keyHandle - Identificador único de la clave
   */
  existsPrivateKey(keyHandle: string): Promise<boolean>;

  /**
   * Emite una lista de todos los key_handles almacenados
   * Útil para auditoría y operaciones de limpieza
   */
  listStoredKeyHandles(): Promise<string[]>;
}
