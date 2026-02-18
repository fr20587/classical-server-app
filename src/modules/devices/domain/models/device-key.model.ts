/**
 * Domain Model: DeviceKey
 * 
 * Representa las claves ECDH P-256 intercambiadas entre un dispositivo y el servidor.
 * Esta es una entidad del núcleo de negocio que define la estructura de las claves criptográficas.
 */

export enum DeviceKeyStatus {
  ACTIVE = 'ACTIVE',
  ROTATED = 'ROTATED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export interface IDeviceKey {
  /** Identificador único en MongoDB */
  id: string;

  /** Identificador único del dispositivo (UUID generado en la app móvil) */
  deviceId: string;

  /** Identificador del usuario proprietario */
  userId: string;

  /** Key handle opaco: identificador único de este par de claves en el servidor */
  keyHandle: string;

  /** Clave pública ECDH P-256 del dispositivo (Base64, 65 bytes uncompressed) */
  devicePublicKey: string;

  /** Clave pública ECDH P-256 del servidor (Base64, 65 bytes uncompressed) */
  serverPublicKey: string;

  /** Salt único de 32 bytes en formato Base64, usado para HKDF en dispositivo */
  saltHex: string;

  /** Estado actual de la clave */
  status: DeviceKeyStatus;

  /** Fecha de emisión de esta clave */
  issuedAt: Date;

  /** Fecha de expiración de esta clave */
  expiresAt: Date;

  /** Plataforma del dispositivo */
  platform: 'android' | 'ios';

  /** Versión de la app móvil que registró esta clave */
  appVersion: string;

  /** Nombre amigable del dispositivo (opcional) */
  deviceName?: string;

  /** Timestamp de creación (Mongoose) */
  createdAt?: Date;

  /** Timestamp de última actualización (Mongoose) */
  updatedAt?: Date;
}

/**
 * Factory para crear instancias de IDeviceKey
 */
export class DeviceKeyModel implements IDeviceKey {
  id: string;
  deviceId: string;
  userId: string;
  keyHandle: string;
  devicePublicKey: string;
  serverPublicKey: string;
  saltHex: string;
  status: DeviceKeyStatus;
  issuedAt: Date;
  expiresAt: Date;
  platform: 'android' | 'ios';
  appVersion: string;
  deviceName?: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(props: Omit<IDeviceKey, 'createdAt' | 'updatedAt'>) {
    this.id = props.id;
    this.deviceId = props.deviceId;
    this.userId = props.userId;
    this.keyHandle = props.keyHandle;
    this.devicePublicKey = props.devicePublicKey;
    this.serverPublicKey = props.serverPublicKey;
    this.saltHex = props.saltHex;
    this.status = props.status;
    this.issuedAt = props.issuedAt;
    this.expiresAt = props.expiresAt;
    this.platform = props.platform;
    this.appVersion = props.appVersion;
  }

  /**
   * Verifica si la clave está activa y no expirada
   */
  isActiveAndValid(): boolean {
    return this.status === DeviceKeyStatus.ACTIVE && new Date() < this.expiresAt;
  }

  /**
   * Verifica si la clave está expirada
   */
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }
}
