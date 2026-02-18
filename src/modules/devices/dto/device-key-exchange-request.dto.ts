/**
 * DTO: DeviceKeyExchangeRequestDto
 * 
 * Solicitud del dispositivo móvil al servidor para intercambiar claves públicas ECDH.
 * Validaciones se aplican usando class-validator.
 */

import {
  IsBase64,
  IsUUID,
  Matches,
  IsIn,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeviceKeyExchangeRequestDto {
  @ApiProperty({
    description:
      'Clave pública ECDH P-256 del dispositivo (Base64, 65 bytes uncompressed)',
    example: 'BK3mNpQvWx7Zr3ah4K9mLjPqRsTuVwXyZ0aBcDeFgHiJkLmNoPqRsTuVwXyZ0aBcDeFgHiJkLmNoPqRsTuVw=',
  })
  @IsBase64()
  @MinLength(88)
  @MaxLength(88)
  device_public_key: string;

  @ApiProperty({
    description: 'Identificador único del dispositivo (UUID v4)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  device_id: string;

  @ApiProperty({
    description: 'Versión de la aplicación móvil (semantic versioning)',
    example: '1.0.0',
  })
  @Matches(/^\d+\.\d+\.\d+$/)
  app_version: string;

  @ApiProperty({
    description: 'Plataforma del dispositivo',
    example: 'android',
    enum: ['android', 'ios'],
  })
  @IsIn(['android', 'ios'])
  platform: 'android' | 'ios';

  @ApiProperty({
    description: 'Nombre amigable del dispositivo (opcional)',
    example: 'Mi iPhone 14',
    required: false,
  })
  @MinLength(1)
  @MaxLength(100)
  device_name?: string;
}
