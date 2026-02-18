/**
 * DTO: DeviceKeyRotationRequestDto
 * 
 * Solicitud para rotar manualmente la clave de un dispositivo.
 */

import { IsOptional, IsIn, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeviceKeyRotationRequestDto {
  @ApiProperty({
    description: 'Nueva clave pública ECDH P-256 (si se genera nuevo par)',
    required: false,
    example: 'BK3mNpQvWx7Zr3ah4K9m...',
  })
  @IsOptional()
  @MinLength(88)
  @MaxLength(88)
  device_public_key?: string;

  @ApiProperty({
    description: 'Razón de la rotación',
    example: 'MANUAL',
    enum: ['MANUAL', 'COMPROMISED'],
  })
  @IsIn(['MANUAL', 'COMPROMISED'])
  @IsOptional()
  reason?: string;
}
