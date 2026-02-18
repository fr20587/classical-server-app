/**
 * Domain Model: DeviceRegistration
 * 
 * Metadata del dispositivo en el momento del registro de claves.
 */

export interface IDeviceRegistration {
  /** Identificador único del dispositivo (UUID generado en la app móvil) */
  deviceId: string;

  /** Identificador del usuario proprietario */
  userId: string;

  /** Versión de la app móvil */
  appVersion: string;

  /** Plataforma del dispositivo */
  platform: 'android' | 'ios';

  /** Timestamp del primer registro */
  registeredAt: Date;

  /** Nombre amigable del dispositivo (opcional, ej: "Mi iPhone 14") */
  deviceName?: string;
}

export class DeviceRegistrationModel implements IDeviceRegistration {
  deviceId: string;
  userId: string;
  appVersion: string;
  platform: 'android' | 'ios';
  registeredAt: Date;
  deviceName?: string;

  constructor(props: IDeviceRegistration) {
    this.deviceId = props.deviceId;
    this.userId = props.userId;
    this.appVersion = props.appVersion;
    this.platform = props.platform;
    this.registeredAt = props.registeredAt;
    this.deviceName = props.deviceName;
  }
}
