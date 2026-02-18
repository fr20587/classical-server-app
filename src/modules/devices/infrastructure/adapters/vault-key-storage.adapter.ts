/**
 * Infrastructure Adapter: VaultKeyStorageAdapter
 * 
 * Delegador para almacenamiento seguro de claves privadas del servidor en HashiCorp Vault.
 * Todas las operaciones de comunicación con Vault están centralizadas en VaultHttpAdapter.
 * Cumple con PCI-DSS requisito 3.6.3.
 */

import { Injectable, Inject } from '@nestjs/common';

import { IVaultKeyStorage } from '../../domain/ports/vault-key-storage.port';
import type { IVaultClient } from 'src/modules/vault/domain/ports/vault-client.port';

import { INJECTION_TOKENS } from 'src/common/constants/injection-tokens';


@Injectable()
export class VaultKeyStorageAdapter implements IVaultKeyStorage {
  constructor(
    @Inject(INJECTION_TOKENS.VAULT_CLIENT)
    private readonly vaultClient: IVaultClient,
  ) {}

  /**
   * Almacena la clave privada del servidor en Vault
   * Ruta: secret/devices/keys/{keyHandle}/private
   */
  async storeServerPrivateKey(keyHandle: string, privatePem: string): Promise<void> {
    const result = await this.vaultClient.storeServerPrivateKey(keyHandle, privatePem);
    
    if (result.isFailure) {
      throw result.getError();
    }
  }

  /**
   * Recupera la clave privada del servidor desde Vault
   * Operación de lectura crítica; puede beneficiarse de caché
   */
  async retrieveServerPrivateKey(keyHandle: string): Promise<string> {
    const result = await this.vaultClient.retrieveServerPrivateKey(keyHandle);
    
    if (result.isFailure) {
      throw result.getError();
    }
    
    return result.getValue();
  }

  /**
   * Elimina la clave privada de Vault (revocación)
   */
  async deleteServerPrivateKey(keyHandle: string): Promise<void> {
    const result = await this.vaultClient.deleteServerPrivateKey(keyHandle);
    
    if (result.isFailure) {
      throw result.getError();
    }
  }

  /**
   * Verifica que una clave privada existe en Vault
   */
  async existsPrivateKey(keyHandle: string): Promise<boolean> {
    return this.vaultClient.existsPrivateKey(keyHandle);
  }

  /**
   * List all stored key handles in Vault
   */
  async listStoredKeyHandles(): Promise<string[]> {
    return this.vaultClient.listStoredKeyHandles();
  }
}
