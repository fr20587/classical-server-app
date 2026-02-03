import { IsString, IsArray, IsOptional, IsBoolean, IsUrl } from 'class-validator';
import { v4 as uuidv4 } from 'uuid';

/**
 * DTO para crear un webhook
 */
export class CreateTenantWebhookDto {
  @IsUrl()
  url: string;

  @IsArray()
  @IsString({ each: true })
  events: string[];

  @IsOptional()
  @IsString()
  secret?: string; // Si no se proporciona, se autogenera
}

/**
 * DTO para actualizar un webhook
 */
export class UpdateTenantWebhookDto {
  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  secret?: string; // Para regenerar el secret
}

/**
 * DTO para respuesta de webhook (con secret masked)
 */
export class WebhookResponseDto {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret: string; // Masked version: "xxxx...last4"
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Helper para mapear webhook a DTO de respuesta
 */
export function mapWebhookToResponse(webhook: any, maskedSecret: string): WebhookResponseDto {
  return {
    id: webhook.id,
    url: webhook.url,
    events: webhook.events,
    active: webhook.active,
    secret: maskedSecret,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt,
  };
}
