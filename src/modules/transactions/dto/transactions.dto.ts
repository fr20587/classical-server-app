import { IsString, IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * DTO para crear una transacción
 * Cliente envía: tenantId, customerId, ref (su número de orden), amount, ttlMinutes
 */
export class CreateTransactionDto {
  @IsString()
  tenantId: string;

  @IsString()
  customerId: string;

  /**
   * Referencia del cliente (número de orden)
   */
  @IsString()
  ref: string;

  /**
   * Monto en centavos
   */
  @IsNumber()
  @Min(1)
  amount: number;

  /**
   * Tiempo de vida en minutos (máximo 1440 = 24 horas)
   */
  @IsNumber()
  @Min(1)
  @Max(1440)
  ttlMinutes?: number;
}

/**
 * DTO para confirmar una transacción
 * Cliente envía: cardId, firma del QR para validar integridad
 */
export class ConfirmTransactionDto {
  @IsString()
  cardId: string;

  /**
   * Firma HMAC-SHA256 del payload del QR
   * Cliente recibe esto en la respuesta de creación
   */
  @IsString()
  signature: string;
}

/**
 * DTO para cancelar una transacción
 * No requiere datos adicionales, la URL tiene el ID
 */
export class CancelTransactionDto {}

/**
 * DTO para filtrar lista de transacciones
 * Admin puede filtrar por status, dateFrom, dateTo, etc.
 */
export class ListTransactionsQueryDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  dateFrom?: string; // ISO string o timestamp

  @IsOptional()
  dateTo?: string; // ISO string o timestamp

  @IsOptional()
  @IsNumber()
  skip?: number;

  @IsOptional()
  @IsNumber()
  take?: number;
}

/**
 * DTO para respuesta al crear transacción
 * Cliente recibe los datos del QR con la firma
 */
export class CreateTransactionResponseDto {
  id: string;
  ref: string;
  no: number;
  amount: number;
  expiresAt: Date;
  /**
   * Payload del QR en JSON para que cliente lo escanee
   */
  payload: Record<string, any>;
  /**
   * Firma HMAC-SHA256 del payload, cliente debe devolverla en confirmación
   */
  signature: string;
}
