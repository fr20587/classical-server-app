/**
 * DTO: KeyRotationHistoryDto
 * 
 * Registro de auditoría de una rotación de clave.
 */

import { ApiProperty } from '@nestjs/swagger';

export class KeyRotationHistoryDto {
  @ApiProperty({
    description: 'Key handle anterior',
    example: 'ah4K9mNpQvWx7Zr3ah4K9mNpQvWx7Zr3',
  })
  previous_key_handle: string;

  @ApiProperty({
    description: 'Key handle nuevo',
    example: 'bh5L0mOrQvWx7Zr3ah4K9mNpQvWx7Zr3',
  })
  new_key_handle: string;

  @ApiProperty({
    description: 'Fecha de la rotación',
    example: '2025-02-15T10:20:30.456Z',
  })
  rotated_at: Date;

  @ApiProperty({
    description: 'Razón de la rotación',
    example: 'PERIODIC',
    enum: ['PERIODIC', 'MANUAL', 'COMPROMISED'],
  })
  reason: string;

  @ApiProperty({
    description: 'Quién inició la rotación (system o userId)',
    example: 'system',
  })
  initiated_by: string;
}
