/**
 * DTO: DeviceKeyExchangeResponseDto
 * 
 * Respuesta del servidor al dispositivo móvil con los parámetros necesarios
 * para derivar el DMK localmente usando HKDF.
 */

import { ApiProperty } from '@nestjs/swagger';

export class DeviceKeyExchangeResponseDto {
  @ApiProperty({
    description:
      'Clave pública ECDH P-256 del servidor (Base64, 65 bytes uncompressed)',
    example: 'BHx7Zr3ah4K9mNpQvWx7Zr3ah4K9mNpQvWx7Zr3ah4K9mNpQvWx7Zr3ah4K9mNpQvWx7Zr3ah4K9mNpQvWx7=',
  })
  server_public_key: string;

  @ApiProperty({
    description:
      'Identificador opaco del par de claves (referencia para futuras transacciones)',
    example: 'ah4K9mNpQvWx7Zr3ah4K9mNpQvWx7Zr3ah4K9mNpQvW',
  })
  key_handle: string;

  @ApiProperty({
    description: 'Salt único de 32 bytes en Base64 para HKDF derivation',
    example: 'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBzYWx0IHZhbHVlLg==',
  })
  salt: string;

  @ApiProperty({
    description: 'Timestamp de emisión en ISO 8601',
    example: '2025-01-15T14:30:25.123Z',
  })
  issued_at: string;

  @ApiProperty({
    description: 'Timestamp de expiración en ISO 8601',
    example: '2026-01-15T14:30:25.123Z',
  })
  expires_at: string;

  @ApiProperty({
    description: 'Versión del protocolo E2E',
    example: 'E2E1',
  })
  protocol_version: string;

  @ApiProperty({
    description:
      'Número de días restantes para expiración (informativo para cliente)',
    example: 364,
  })
  days_until_expiration: number;
}
