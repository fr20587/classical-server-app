/**
 * Domain Port: KeyRotation
 * 
 * Contrato para auditoría y historial de rotaciones de claves.
 */

import type { IKeyRotationRecord } from '../models/key-rotation.model';
import { PaginationMeta } from 'src/common/types';

export interface IKeyRotationPort {
  /**
   * Registra una rotación de clave en el historial de auditoría
   */
  recordRotation(record: Omit<IKeyRotationRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<IKeyRotationRecord>;

  /**
   * Obtiene el historial completo de rotaciones de un dispositivo
   */
  getHistoryByDeviceId(
    deviceId: string,
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<{ data: IKeyRotationRecord[]; meta: PaginationMeta }>;

  /**
   * Obtiene el última rotación de un dispositivo
   */
  getLastRotation(deviceId: string): Promise<IKeyRotationRecord | null>;

  /**
   * Cuenta cuántas rotaciones ha habido en las últimas 24 horas
   */
  countRotationsIn24Hours(deviceId: string): Promise<number>;

  /**
   * Obtiene todas las rotaciones de un usuario (auditoría global)
   */
  findByUserId(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<IKeyRotationRecord[]>;
}
