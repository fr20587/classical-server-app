/**
 * Domain Port: DeviceRepository
 * 
 * Contrato para la persistencia de dispositivos y sus claves ECDH.
 * Implementación Hexagonal: separa la lógica de negocio del almacenamiento.
 */

import type { IDeviceKey } from '../models/device-key.model';
import { PaginationMeta } from 'src/common/types';

export interface IDeviceRepository {
  /**
   * Busca una clave de dispositivo por deviceId
   */
  findByDeviceId(deviceId: string): Promise<IDeviceKey | null>;

  /**
   * Busca una clave de dispositivo por key_handle
   */
  findByKeyHandle(keyHandle: string): Promise<IDeviceKey | null>;

  /**
   * Busca todas las claves ACTIVAS de un usuario
   */
  findActiveByUserId(userId: string): Promise<IDeviceKey[]>;

  /**
   * Crea una nueva entrada de clave de dispositivo
   */
  create(deviceKey: Omit<IDeviceKey, 'id' | 'createdAt' | 'updatedAt'>): Promise<IDeviceKey>;

  /**
   * Actualiza una clave de dispositivo existente
   */
  update(
    id: string,
    partial: Partial<Omit<IDeviceKey, 'id' | 'createdAt'>>,
  ): Promise<IDeviceKey>;

  /**
   * Marca una clave como ROTATED o REVOKED (soft delete)
   */
  updateStatus(id: string, status: string): Promise<IDeviceKey>;

  /**
   * Obtiene el total de dispositivos activos de un usuario
   */
  countActiveDevicesByUserId(userId: string): Promise<number>;

  /**
   * Lista las claves expiradas que deben ser refrescadas
   */
  findExpiredKeys(expirationThresholdDays: number): Promise<IDeviceKey[]>;

  /**
   * Obtiene pagina de historial de claves de un dispositivo
   */
  findDeviceHistory(
    deviceId: string,
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<{ data: IDeviceKey[]; meta: PaginationMeta }>;

  /**
   * Verifica si un dispositivo existe
   */
  exists(deviceId: string, userId: string): Promise<boolean>;

  /**
   * Elimina lógicamente todas las claves de un usuario (revocación masiva)
   */
  revokeAllByUserId(userId: string, reason: string): Promise<number>;
}
