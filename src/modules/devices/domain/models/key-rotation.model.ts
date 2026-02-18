/**
 * Domain Model: KeyRotationRecord
 * 
 * Registro de auditoría de cada rotación de clave ECDH que ocurre en el sistema.
 */

export enum KeyRotationReason {
  PERIODIC = 'PERIODIC',        // Rotación automática periódica
  MANUAL = 'MANUAL',            // Usuario solicitó rotación manual
  COMPROMISED = 'COMPROMISED',  // La clave fue comprometida
}

export interface IKeyRotationRecord {
  /** Identificador único en MongoDB */
  id: string;

  /** Identificador del dispositivo */
  deviceId: string;

  /** Identificador del usuario */
  userId: string;

  /** Key handle anterior (la clave que se está reemplazando) */
  previousKeyHandle: string;

  /** Key handle nuevo (la clave que reemplaza) */
  newKeyHandle: string;

  /** Razón de la rotación */
  reason: KeyRotationReason;

  /** ID del usuario o sistema que inició la rotación */
  initiatedBy: string; // 'system' o userId

  /** Timestamp de la rotación */
  rotatedAt: Date;

  /** Timestamp de creación del registro */
  createdAt?: Date;

  /** Timestamp de última actualización */
  updatedAt?: Date;
}

export class KeyRotationRecordModel implements IKeyRotationRecord {
  id: string;
  deviceId: string;
  userId: string;
  previousKeyHandle: string;
  newKeyHandle: string;
  reason: KeyRotationReason;
  initiatedBy: string;
  rotatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(props: Omit<IKeyRotationRecord, 'createdAt' | 'updatedAt'>) {
    this.id = props.id;
    this.deviceId = props.deviceId;
    this.userId = props.userId;
    this.previousKeyHandle = props.previousKeyHandle;
    this.newKeyHandle = props.newKeyHandle;
    this.reason = props.reason;
    this.initiatedBy = props.initiatedBy;
    this.rotatedAt = props.rotatedAt;
  }
}
