import { Result } from 'src/common/types/result.type';

/**
 * Datos internos de la respuesta de activación de PIN del SGT
 */
export interface SgtActivatePinData {
  activationCode: string;
  isoResponseCode?: string;
  token?: string;
  balance?: string;
  additionalAmounts?: string;
  expirationDate?: string;
}

/**
 * Respuesta del servidor SGT al activar PIN de una tarjeta
 */
export interface SgtActivatePinResponse {
  ok: boolean;
  message: string;
  data?: SgtActivatePinData;
}

/**
 * Puerto de salida para la integración con el servidor SGT
 * Implementado por SgtCardAdapter en la capa de infraestructura
 */
export interface ISgtCardPort {
  /**
   * Verifica y activa el PIN de una tarjeta contra el módulo emisor (SGT)
   * Endpoint: POST /activate-pin
   * Auth: HMAC-SHA256
   *
   * @param token - Token del PAN recibido en un registro previo (AP002), para reintento de activación
   */
  activatePin(
    cardId: string,
    pan: string,
    pinblock: string,
    idNumber: string,
    tml: string,
    aut: string,
    token?: string,
  ): Promise<Result<SgtActivatePinResponse, Error>>;
}
