import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';

import { AsyncContextService } from 'src/common/context';
import { ApiResponse } from 'src/common/types';
import { HttpStatus } from '@nestjs/common';

import { TransactionsRepository } from '../../infrastructure/adapters/transactions.repository';
import { UsersRepository } from 'src/modules/users/infrastructure/adapters/users.repository';
import { TenantsRepository } from 'src/modules/tenants/infrastructure/adapters/tenant.repository';
import { CardsRepository } from 'src/modules/cards/infrastructure/adapters';

import {
  DashboardStatsQueryDto,
  DashboardStatsResponseDto,
  TransactionVolumeDto,
  TransactionCountDto,
  ClientsStatsDto,
  TenantsStatsDto,
  CardsByTypeDto,
  DailyTrendDto,
  StatusDistributionDto,
  RecentTransactionDto,
} from '../../dto/dashboard.dto';

/**
 * Servicio de Dashboard - Orquesta la obtención de estadísticas
 * Implementa control de acceso: admins ven datos globales, tenants ven sus datos
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly asyncContextService: AsyncContextService,
    private readonly transactionsRepository: TransactionsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly tenantsRepository: TenantsRepository,
    private readonly cardsRepository: CardsRepository,
  ) {}

  /**
   * Obtiene estadísticas del dashboard para un rango de fechas
   * Control de acceso:
   * - Admin: retorna datos globales
   * - Tenant Admin: retorna datos de su tenant
   * - User: acceso denegado
   */
  async getStatistics(
    query: DashboardStatsQueryDto,
  ): Promise<ApiResponse<DashboardStatsResponseDto>> {
    const requestId = this.asyncContextService.getRequestId();
    const actor = this.asyncContextService.getActor();

    this.logger.log(
      `[${requestId}] Obteniendo estadísticas para rango: ${query.from} - ${query.to}`,
    );

    try {
      // Validar que las fechas sean válidas
      const from = new Date(query.from);
      const to = new Date(query.to);

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new BadRequestException('Las fechas no son válidas. Formato esperado: ISO 8601');
      }

      if (from >= to) {
        throw new BadRequestException('from debe ser menor que to');
      }

      // Determinar si el usuario tiene acceso y qué tenantId filtrar
      let effectiveTenantId: string | undefined;
      let hasAccess = false;

      if (!actor) {
        throw new ForbiddenException('No autorizado. Actor no encontrado.');
      }

      // Obtener usuario actual
      const user = await this.usersRepository.findById(actor.actorId);
      if (!user) {
        throw new ForbiddenException('Usuario no encontrado');
      }

      // Validar rol para acceso
      const isAdmin = user.roleKey === 'admin' || user.isSystemAdmin;
      const isTenant = user.roleKey === 'tenant-admin' || (user.additionalRoleKeys?.includes('tenant-admin') ?? false);

      if (!isAdmin && !isTenant) {
        // Los usuarios normales (roleKey='user') no pueden acceder
        throw new ForbiddenException(
          'Sin permisos para acceder a estadísticas. Solo admins y tenant admins pueden acceder.',
        );
      }

      // Si es admin, puede filtrar por tenantId si lo proporciona
      if (isAdmin) {
        effectiveTenantId = query.tenantId;
        hasAccess = true;
        this.logger.log(`[${requestId}] Admin accediendo a estadísticas globales`);
      }

      // Si es tenant-admin, puede acceder solo a sus propios datos
      if (isTenant && !isAdmin) {
        if (query.tenantId && query.tenantId !== user.tenantId) {
          throw new ForbiddenException(
            'No tienes permisos para ver estadísticas de otro tenant',
          );
        }
        effectiveTenantId = user.tenantId;
        hasAccess = true;
        this.logger.log(
          `[${requestId}] Tenant-admin accediendo a estadísticas de tenant: ${effectiveTenantId}`,
        );
      }

      if (!hasAccess) {
        throw new ForbiddenException('Acceso denegado a estadísticas');
      }

      // Obtener todas las estadísticas en paralelo
      const [
        volumeStats,
        countStats,
        clientsStats,
        tenantsStats,
        cardStatsByTypeAndStatus,
        dailyTrends,
        statusDistribution,
        recentTransactions,
      ] = await Promise.all([
        this.transactionsRepository.getTransactionVolumeStats(
          query.from,
          query.to,
          effectiveTenantId,
        ),
        this.transactionsRepository.getTransactionCountStats(
          query.from,
          query.to,
          effectiveTenantId,
        ),
        this.usersRepository.getActiveUserStats(
          query.from,
          query.to,
          effectiveTenantId,
        ),
        this.tenantsRepository.getActiveTenantStats(query.from, query.to),
        this.cardsRepository.getCardStatsByTypeAndStatus(),
        this.transactionsRepository.getDailyTrendByDayOfWeek(
          query.from,
          query.to,
          effectiveTenantId,
        ),
        this.transactionsRepository.getStatusDistribution(
          query.from,
          query.to,
          effectiveTenantId,
        ),
        this.transactionsRepository.getRecentTransactions(10, effectiveTenantId),
      ]);

      // Calcular tendencias
      const volumeTrend = this.calculateTrend(volumeStats.previous, volumeStats.current);
      const countTrend = this.calculateTrend(countStats.previous, countStats.current);
      const clientsTrend = this.calculateTrend(clientsStats.previous, clientsStats.current);
      const tenantsTrend = this.calculateTrend(tenantsStats.previous, tenantsStats.current);

      // Agrupar estadísticas de tarjetas por tipo
      const cardsStatsMap: Record<string, CardsByTypeDto> = {};

      // Inicializar con tipos conocidos
      cardStatsByTypeAndStatus.forEach((stat: any) => {
        const cardType = stat.cardType || 'UNKNOWN';
        if (!cardsStatsMap[cardType]) {
          cardsStatsMap[cardType] = {
            total: 0,
            byStatus: {},
          };
        }

        cardsStatsMap[cardType].total += stat.count;
        if (!cardsStatsMap[cardType].byStatus[stat.status]) {
          cardsStatsMap[cardType].byStatus[stat.status] = 0;
        }
        cardsStatsMap[cardType].byStatus[stat.status] += stat.count;
      });

      // Convertir transacciones recientes a DTO
      const recentTransactionsDtos: RecentTransactionDto[] = recentTransactions.map(
        (tx) => ({
          id: tx.id,
          ref: tx.ref,
          no: tx.no,
          amount: tx.amount,
          status: tx.status,
          customerId: tx.customerId,
          tenantId: tx.tenantId,
          tenantName: tx.tenantName,
          createdAt: tx.createdAt.toISOString(),
        }),
      );

      // Construir respuesta
      const response: DashboardStatsResponseDto = {
        volumeStats: {
          total: volumeStats.current,
          trend: volumeTrend,
        },
        countStats: {
          count: countStats.current,
          trend: countTrend,
        },
        clientsStats: {
          activeCount: clientsStats.current,
          trend: clientsTrend,
        },
        tenantsStats: {
          activeCount: tenantsStats.current,
          trend: tenantsTrend,
        },
        cardsStats: cardsStatsMap,
        dailyTrends: dailyTrends.map(
          (dt: any): DailyTrendDto => ({
            dayOfWeek: dt.dayOfWeekName,
            successfulCount: dt.successfulCount || 0,
            failedCount: dt.failedCount || 0,
            successfulAmount: dt.successfulAmount || 0,
            failedAmount: dt.failedAmount || 0,
          }),
        ),
        statusDistribution: statusDistribution.map(
          (sd: any): StatusDistributionDto => ({
            status: sd.status,
            percentage: Math.round(sd.percentage * 100) / 100,
          }),
        ),
        recentTransactions: recentTransactionsDtos,
      };

      return ApiResponse.ok<DashboardStatsResponseDto>(
        HttpStatus.OK,
        response,
        'Estadísticas obtenidas exitosamente',
        {
          requestId,
          dateRange: {
            from: query.from,
            to: query.to,
          },
          tenantId: effectiveTenantId,
        },
      );
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        this.logger.warn(`[${requestId}] ${errorMsg}`);
        return ApiResponse.fail<DashboardStatsResponseDto>(
          error.getStatus?.() || HttpStatus.FORBIDDEN,
          errorMsg,
          error.message || 'Error en la solicitud',
          { requestId },
        );
      }

      this.logger.error(`[${requestId}] Error obteniendo estadísticas: ${errorMsg}`, error);

      return ApiResponse.fail<DashboardStatsResponseDto>(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Error interno del servidor',
        'Error desconocido',
        { requestId },
      );
    }
  }

  /**
   * Calcula el porcentaje de tendencia
   * Fórmula: ((actual - anterior) / anterior) * 100
   * Si anterior es 0, retorna 0
   */
  private calculateTrend(previous: number, current: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 10000) / 100; // 2 decimales
  }
}
