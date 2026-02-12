import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import type { UserDTO } from 'src/modules/users/domain/ports/users.port';
import { SessionStatus, ISessionTokenUpdate } from '../domain/models/session.model';

/**
 * DTO para crear una nueva sesión
 */
export class CreateSessionDto {
  @ApiProperty({
    description: 'ID del usuario que inicia sesión',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Snapshot del usuario al momento del login',
    type: Object,
  })
  user: UserDTO;

  @ApiProperty({
    description: 'Timestamp cuando se inició la sesión',
    example: '2026-02-12T10:30:00Z',
  })
  @IsDate()
  loginTimestamp: Date;

  @ApiProperty({
    description: 'Tipo de token (siempre "Bearer")',
    example: 'Bearer',
  })
  @IsString()
  tokenType: string;

  @ApiProperty({
    description: 'Segundos hasta que vence el access token',
    example: 3600,
  })
  accessTokenExpiresIn: number;

  @ApiProperty({
    description: 'Dirección IP desde donde se inició la sesión (opcional)',
    required: false,
    example: '192.168.1.100',
  })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({
    description: 'User Agent del cliente (opcional)',
    required: false,
    example: 'Mozilla/5.0...',
  })
  @IsOptional()
  @IsString()
  userAgent?: string;
}

/**
 * DTO para respuesta de sesión (lectura)
 */
export class SessionResponseDto {
  @ApiProperty({
    description: 'ID único de la sesión',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'ID del usuario',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Datos del usuario',
    type: Object,
  })
  user: UserDTO;

  @ApiProperty({
    description: 'Estado actual de la sesión',
    enum: SessionStatus,
    example: SessionStatus.ACTIVE,
  })
  @IsEnum(SessionStatus)
  status: SessionStatus;

  @ApiProperty({
    description: 'Timestamp cuando se inició la sesión',
    example: '2026-02-12T10:30:00Z',
  })
  @IsDate()
  loginTimestamp: Date;

  @ApiProperty({
    description: 'Última actividad registrada en la sesión',
    example: '2026-02-12T10:45:00Z',
  })
  @IsDate()
  lastActivityTime: Date;

  @ApiProperty({
    description: 'Historial de actualizaciones de access token',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        tokenPreview: { type: 'string' },
      },
    },
  })
  tokenUpdates: ISessionTokenUpdate[];

  @ApiProperty({
    description: 'Fecha de expiración de la sesión',
    example: '2026-02-19T10:30:00Z',
  })
  @IsDate()
  expiresAt: Date;

  @ApiProperty({
    description: 'Timestamp de creación',
    example: '2026-02-12T10:30:00Z',
  })
  @IsDate()
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp de última actualización',
    example: '2026-02-12T10:45:00Z',
  })
  @IsDate()
  updatedAt: Date;

  @ApiProperty({
    description: 'Dirección IP (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({
    description: 'User Agent (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  userAgent?: string;
}
