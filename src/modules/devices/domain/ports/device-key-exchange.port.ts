/**
 * Application Port: DeviceKeyExchange
 * 
 * Contrato para el flujo completo de intercambio de claves públicas ECDH
 * entre dispositivo móvil y servidor.
 */

import { DeviceKeyExchangeRequestDto } from '../../dto/device-key-exchange-request.dto';
import { DeviceKeyExchangeResponseDto } from '../../dto/device-key-exchange-response.dto';

export interface IDeviceKeyExchange {
  /**
   * Flujo principal: intercambio seguro de claves públicas ECDH P-256
   *
   * Pasos:
   * 1. Valida que userId está autenticado
   * 2. Si deviceId ya existe: inicia rotación de clave (reemplaza anterior)
   * 3. Genera par de claves del servidor (una sola vez, luego recupera de Vault)
   * 4. Calcula shared_secret = ECDH(serverPrivateKey, devicePublicKey)
   * 5. Genera salt único de 32 bytes
   * 6. Almacena clave privada en Vault
   * 7. Persiste metadatos en MongoDB
   * 8. Emite evento DeviceRegisteredEvent
   * 9. Retorna serverPublicKey + salt al cliente para HKDF
   *
   * @param userId - UUID del usuario autenticado
   * @param request - Clave pública del dispositivo + metadata
   * @returns Clave pública del servidor + salt + key_handle para futuras transacciones
   */
  exchangePublicKeyWithDevice(
    userId: string,
    request: DeviceKeyExchangeRequestDto,
  ): Promise<DeviceKeyExchangeResponseDto>;
}
