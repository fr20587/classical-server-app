import { IsString, IsDateString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus } from '../domain/entities/transaction.entity';

/**
 * DTO para consultar estadísticas del dashboard
 */
export class DashboardStatsQueryDto {
  @ApiProperty({
    description: 'Fecha inicial del rango (ISO 8601)',
    example: '2026-02-01T00:00:00Z',
  })
  @IsDateString()
  from: string;

  @ApiProperty({
    description: 'Fecha final del rango (ISO 8601)',
    example: '2026-02-12T23:59:59Z',
  })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({
    description: 'ID del tenant para filtrar estadísticas (si no se proporciona, retorna datos globales)',
    example: 'tenant-uuid',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

/**
 * DTO para estadísticas de volumen de transacciones
 */
export class TransactionVolumeDto {
  @ApiProperty({
    description: 'Monto total de transacciones en el período (en centavos)',
    example: 125000,
  })
  total: number;

  @ApiProperty({
    description: 'Tendencia en porcentaje: ((actual - anterior) / anterior) * 100',
    example: 20.5,
  })
  trend: number;
}

/**
 * DTO para conteo de transacciones
 */
export class TransactionCountDto {
  @ApiProperty({
    description: 'Cantidad de transacciones',
    example: 450,
  })
  count: number;

  @ApiProperty({
    description: 'Tendencia en porcentaje',
    example: 15.3,
  })
  trend: number;
}

/**
 * DTO para estadísticas de clientes
 */
export class ClientsStatsDto {
  @ApiProperty({
    description: 'Cantidad de usuarios activos con roleKey=user',
    example: 280,
  })
  activeCount: number;

  @ApiProperty({
    description: 'Tendencia en porcentaje',
    example: -5.2,
  })
  trend: number;
}

/**
 * DTO para estadísticas de tenants
 */
export class TenantsStatsDto {
  @ApiProperty({
    description: 'Cantidad de tenants activos',
    example: 42,
  })
  activeCount: number;

  @ApiProperty({
    description: 'Tendencia en porcentaje',
    example: 10.0,
  })
  trend: number;
}

/**
 * DTO para estado de tarjeta
 */
export class CardStatusBreakdownDto {
  @ApiProperty({
    description: 'Cantidad de tarjetas activas',
    example: 450,
  })
  ACTIVE?: number;

  @ApiProperty({
    description: 'Cantidad de tarjetas bloqueadas',
    example: 30,
  })
  BLOCKED?: number;

  @ApiProperty({
    description: 'Cantidad de tarjetas expiradas',
    example: 20,
  })
  EXPIRED?: number;
}

/**
 * DTO para estadísticas de tarjetas por tipo
 */
export class CardsByTypeDto {
  @ApiProperty({
    description: 'Total de tarjetas de este tipo',
    example: 500,
  })
  total: number;

  @ApiProperty({
    description: 'Desglose por estado',
    type: CardStatusBreakdownDto,
  })
  byStatus: CardStatusBreakdownDto;
}

/**
 * DTO para tendencias diarias por día de la semana
 */
export class DailyTrendDto {
  @ApiProperty({
    description: 'Día de la semana (Monday-Sunday)',
    example: 'Monday',
  })
  dayOfWeek: string;

  @ApiProperty({
    description: 'Cantidad de transacciones exitosas (no CANCELLED, no EXPIRED)',
    example: 45,
  })
  successfulCount: number;

  @ApiProperty({
    description: 'Cantidad de transacciones fallidas (CANCELLED + EXPIRED)',
    example: 3,
  })
  failedCount: number;

  @ApiProperty({
    description: 'Importe total de transacciones exitosas (en centavos)',
    example: 18500,
  })
  successfulAmount: number;

  @ApiProperty({
    description: 'Importe total de transacciones fallidas (en centavos)',
    example: 250,
  })
  failedAmount: number;
}

/**
 * DTO para distribución de transacciones por estado
 */
export class StatusDistributionDto {
  @ApiProperty({
    description: 'Estado de la transacción',
    enum: TransactionStatus,
    example: TransactionStatus.NEW,
  })
  status: string;

  @ApiProperty({
    description: 'Porcentaje del total de transacciones',
    example: 5.2,
  })
  percentage: number;
}

/**
 * DTO para transacción reciente
 */
export class RecentTransactionDto {
  @ApiProperty({
    description: 'ID de la transacción',
    example: 'uuid-1',
  })
  id: string;

  @ApiProperty({
    description: 'Referencia del cliente',
    example: 'REF-001',
  })
  ref: string;

  @ApiProperty({
    description: 'Número secuencial',
    example: 12345,
  })
  no: number;

  @ApiProperty({
    description: 'Monto en centavos',
    example: 50000,
  })
  amount: number;

  @ApiProperty({
    description: 'Estado de la transacción',
    enum: TransactionStatus,
    example: TransactionStatus.SUCCESS,
  })
  status: string;

  @ApiPropertyOptional({
    description: 'ID del cliente',
    example: 'user-1',
  })
  customerId?: string;

  @ApiProperty({
    description: 'ID del tenant',
    example: 'tenant-1',
  })
  tenantId: string;

  @ApiProperty({
    description: 'Nombre del tenant',
    example: 'Mi Empresa',
  })
  tenantName: string;

  @ApiProperty({
    description: 'Fecha de creación (ISO 8601)',
    example: '2026-02-12T15:30:00Z',
  })
  createdAt: string;
}

/**
 * DTO para respuesta de estadísticas del dashboard
 */
export class DashboardStatsResponseDto {
  @ApiProperty({
    description: 'Estadísticas de volumen de transacciones',
    type: TransactionVolumeDto,
  })
  volumeStats: TransactionVolumeDto;

  @ApiProperty({
    description: 'Estadísticas de conteo de transacciones',
    type: TransactionCountDto,
  })
  countStats: TransactionCountDto;

  @ApiProperty({
    description: 'Estadísticas de clientes activos',
    type: ClientsStatsDto,
  })
  clientsStats: ClientsStatsDto;

  @ApiProperty({
    description: 'Estadísticas de tenants',
    type: TenantsStatsDto,
  })
  tenantsStats: TenantsStatsDto;

  @ApiProperty({
    description: 'Estadísticas de tarjetas por tipo',
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/CardsByTypeDto' },
    example: {
      PERSONAL: {
        total: 500,
        byStatus: { ACTIVE: 450, BLOCKED: 30, EXPIRED: 20 },
      },
      BUSINESS: {
        total: 150,
        byStatus: { ACTIVE: 140, BLOCKED: 10, EXPIRED: 0 },
      },
    },
  })
  cardsStats: Record<string, CardsByTypeDto>;

  @ApiProperty({
    description: 'Tendencias diarias por día de la semana',
    type: [DailyTrendDto],
  })
  dailyTrends: DailyTrendDto[];

  @ApiProperty({
    description: 'Distribución de transacciones por estado (porcentajes)',
    type: [StatusDistributionDto],
  })
  statusDistribution: StatusDistributionDto[];

  @ApiProperty({
    description: 'Últimas 10 transacciones ordenadas por fecha DESC',
    type: [RecentTransactionDto],
  })
  recentTransactions: RecentTransactionDto[];
}
