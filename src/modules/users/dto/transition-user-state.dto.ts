import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserStatus } from '../domain/enums/enums';

/**
 * DTO para cambiar el estado de un usuario
 *
 * Transiciones válidas según la máquina de estados:
 * - INACTIVE → ACTIVE (verificación de teléfono)
 * - ACTIVE → SUSPENDED (reporte de incidencia)
 * - SUSPENDED → ACTIVE (incidencia resuelta)
 * - {INACTIVE | ACTIVE | SUSPENDED} → DISABLED (cierre de cuenta)
 */
export class TransitionUserStateDto {
  @ApiProperty({
    description: 'Estado destino del usuario',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  @IsEnum(UserStatus, {
    message: `El estado debe ser uno de: ${Object.values(UserStatus).join(', ')}`,
  })
  targetState!: UserStatus;

  @ApiPropertyOptional({
    description: 'Motivo o comentario sobre la transición de estado',
    example: 'Teléfono verificado correctamente',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El comentario debe ser una cadena de texto' })
  @MaxLength(500, { message: 'El comentario no puede exceder los 500 caracteres' })
  reason?: string;
}
