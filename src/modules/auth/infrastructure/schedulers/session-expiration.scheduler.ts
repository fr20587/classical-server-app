import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionPersistenceService } from '../services/session-persistence.service';
import { AuditService } from 'src/modules/audit/application/audit.service';

/**
 * Tarea scheduled para expiración automática de sesiones
 * Se ejecuta cada hora para buscar sesiones activas cuya fecha de expiración ha pasado
 * y marcarlas como EXPIRED
 */
@Injectable()
export class SessionExpirationScheduler {
  private readonly logger = new Logger(SessionExpirationScheduler.name);

  constructor(
    private readonly sessionPersistenceService: SessionPersistenceService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Ejecuta cada hora para limpiar sesiones expiradas
   * Busca todas las sesiones ACTIVE donde expiresAt < ahora
   * y las marca como EXPIRED
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireExpiredSessions(): Promise<void> {
    try {
      this.logger.debug('Iniciando scheduler de expiración de sesiones');

      const result = await this.sessionPersistenceService.expireExpiredSessions();

      if (result.isSuccess) {
        if (result.count > 0) {
          this.logger.log(
            `${result.count} sesiones marcadas como EXPIRED en scheduler de expiración`,
          );

          // Registrar el evento en auditoría
          this.auditService.logAllow(
            'SESSION_EXPIRATION_SCHEDULER',
            'system',
            'scheduler',
            {
              severity: 'LOW',
              tags: ['session-management', 'scheduler', 'expiration'],
              changes: {
                after: {
                  sessionsExpired: result.count,
                  timestamp: new Date().toISOString(),
                },
              },
            },
          );
        } else {
          this.logger.debug('No hay sesiones expiradas para marcar');
        }
      } else {
        this.logger.error(
          `Error durante scheduler de expiración de sesiones: ${result.error}`,
        );

        // Registrar el error en auditoría
        this.auditService.logError(
          'SESSION_EXPIRATION_SCHEDULER',
          'system',
          'scheduler',
          new Error(result.error || 'Unknown error'),
          {
            severity: 'MEDIUM',
            tags: ['session-management', 'scheduler', 'error'],
          },
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error durante scheduler de expiración de sesiones: ${errorMsg}`);

      // Registrar el error en auditoría
      this.auditService.logError(
        'SESSION_EXPIRATION_SCHEDULER',
        'system',
        'scheduler',
        error instanceof Error ? error : new Error(String(error)),
        {
          severity: 'HIGH',
          tags: ['session-management', 'scheduler', 'error'],
        },
      );

      // No relanzar error, permitir que el scheduler continúe ejecutándose
    }
  }
}
