import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * UpdateUserRolesDto: DTO para actualizar el rol de un usuario
 *
 * IMPORTANTE:
 * - Un usuario solo puede tener UN ÚNICO rol (no array)
 * - El roleKey debe ser una cadena de texto válida
 */
export class UpdateUserRolesDto {
  @ApiProperty({
    description: 'Rol único a asignar al usuario (NOT an array)',
  })
  @IsString({ message: 'roleKey debe ser un string válido' })
  roleKey: string;
}
