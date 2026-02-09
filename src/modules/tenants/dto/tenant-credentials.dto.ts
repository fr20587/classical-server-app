import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, IsArray, IsBoolean } from 'class-validator';

/**
 * DTO para la respuesta de credenciales (OAuth2 y Webhook)
 */
export class TenantCredentialsResponseDto {
  @ApiProperty({
    description: 'Credenciales OAuth2 del tenant',
  })
  oauth2: {
    clientId: string;
    clientSecret: string;
  };

  @ApiProperty({
    description: 'Configuración del webhook del tenant',
  })
  webhook: {
    id: string;
    url: string | null;
    events: string[];
    secret: string;
  };
}

/**
 * DTO para actualizar las credenciales (principalmente el webhook)
 */
export class UpdateTenantCredentialsDto {
  @ApiPropertyOptional({
    description: 'URL del webhook',
    example: 'https://miapp.com/webhook',
  })
  @IsOptional()
  @IsUrl({}, { message: 'La URL debe ser válida' })
  webhookUrl?: string;

  @ApiPropertyOptional({
    description: 'Eventos del webhook',
    example: ['transaction.created'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'events debe ser un arreglo' })
  @IsString({ each: true, message: 'Cada evento debe ser una cadena' })
  webhookEvents?: string[];

}
