import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Datos internos de la respuesta de activación de PIN
 * Va dentro del campo `data` de la respuesta estándar
 */
export class ActivatePinDataDTO {
  @ApiProperty({
    description: 'Código de activación: AP000=éxito, AP001=registro rechazado, AP002=registro OK/activación fallida, AP003=activación OK/balance fallido, AP004=error comunicación',
    example: 'AP000',
  })
  activationCode: string;

  @ApiPropertyOptional({ description: 'Código de respuesta ISO 8583 del emisor', example: '05' })
  isoResponseCode?: string;

  @ApiPropertyOptional({ description: 'PAN tokenizado recibido del emisor', example: '0400000000701851' })
  token?: string;

  @ApiPropertyOptional({ description: 'Saldo de la tarjeta', example: '000000001544' })
  balance?: string;

  @ApiPropertyOptional({ description: 'Montos adicionales', example: 'C000000001544' })
  additionalAmounts?: string;

  @ApiPropertyOptional({ description: 'Fecha de expiración (YYMM)', example: '1230' })
  expirationDate?: string;
}

/**
 * Respuesta estándar del flujo de activación de PIN
 * Sigue el patrón: { ok, message, data }
 */
export class ActivatePinResponseDTO {
  @ApiProperty({ description: 'Indica éxito o fracaso de la operación', example: true })
  ok: boolean;

  @ApiProperty({ description: 'Mensaje descriptivo de la respuesta', example: 'Registro y activación exitosa' })
  message: string;

  @ApiPropertyOptional({ description: 'Datos de la activación', type: ActivatePinDataDTO })
  data?: ActivatePinDataDTO;
}
