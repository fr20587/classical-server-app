/**
 * DTO: DeviceInfoDto
 * 
 * Información pública de un dispositivo registrado.
 */

import { ApiProperty } from '@nestjs/swagger';

export class DeviceInfoDto {
  @ApiProperty({
    description: 'Identificador único del dispositivo',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  device_id: string;

  @ApiProperty({
    description: 'Plataforma',
    example: 'android',
  })
  platform: 'android' | 'ios';

  @ApiProperty({
    description: 'Versión de la app',
    example: '1.0.0',
  })
  app_version: string;

  @ApiProperty({
    description: 'Key handle actual',
    example: 'ah4K9mNpQvWx7Zr3ah4K9mNpQvWx7Zr3',
  })
  key_handle: string;

  @ApiProperty({
    description: 'Estado de la clave',
    example: 'ACTIVE',
  })
  status: string;

  @ApiProperty({
    description: 'Fecha de emisión',
    example: '2025-01-15T14:30:25.123Z',
  })
  issued_at: Date;

  @ApiProperty({
    description: 'Fecha de expiración',
    example: '2026-01-15T14:30:25.123Z',
  })
  expires_at: Date;

  @ApiProperty({
    description: 'Nombre amigable del dispositivo',
    example: 'Mi iPhone 14',
    required: false,
  })
  device_name?: string;
}
