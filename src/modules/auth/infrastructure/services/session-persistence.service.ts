import { Injectable, Logger } from '@nestjs/common';
import { SessionRepository } from '../adapters/session.repository';
import {
  ISession,
  ISessionOperationResult,
  ISessionTokenUpdate,
  SessionStatus,
} from '../../domain/models/session.model';
import { UserDTO } from 'src/modules/users/domain/ports/users.port';

/**
 * Servicio de persistencia de sesiones en MongoDB
 * Orquesta las operaciones del repository y proporciona métodos de negocio
 */
@Injectable()
export class SessionPersistenceService {
  private readonly logger = new Logger(SessionPersistenceService.name);

  constructor(private readonly sessionRepository: SessionRepository) {}

  /**
   * Crear una nueva sesión cuando un usuario inicia sesión
   * @param userId ID del usuario
   * @param user Datos del usuario
   * @param loginTimestamp Timestamp del login
   * @param tokenType Tipo de token (Bearer)
   * @param ipAddress Dirección IP (opcional)
   * @param userAgent User Agent (opcional)
   * @returns Resultado con la sesión creada
   */
  async createSession(
    userId: string,
    user: UserDTO,
    loginTimestamp: Date,
    tokenType: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ISessionOperationResult<ISession>> {
    try {
      const now = new Date();
      // Sesión expira en 7 días (604800 segundos = los mismos segundos del refresh token TTL)
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const result = await this.sessionRepository.create({
        userId,
        user,
        status: SessionStatus.ACTIVE,
        loginTimestamp,
        lastActivityTime: now,
        tokenUpdates: [],
        expiresAt,
        ipAddress,
        userAgent,
      } as Partial<ISession>);

      if (result.isSuccess) {
        this.logger.log(`Session created for user ${userId}`);
      } else {
        this.logger.error(`Failed to create session for user ${userId}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error creating session for user ${userId}: ${errorMsg}`);
      return {
        isSuccess: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Registrar una actualización de access token en el historial
   * Extrae preview del token (primeros 5 + "..." + últimos 5 caracteres)
   * @param userId ID del usuario
   * @param newAccessToken Token completo del cual extraer preview
   * @returns Resultado de la actualización
   */
  async recordAccessTokenRefresh(
    userId: string,
    newAccessToken: string,
  ): Promise<ISessionOperationResult<ISession>> {
    try {
      const tokenPreview = this.extractTokenPreview(newAccessToken);

      const result = await this.sessionRepository.updateTokenHistory(
        userId,
        tokenPreview,
      );

      if (result.isSuccess) {
        this.logger.debug(
          `Access token refresh recorded for user ${userId}. Preview: ${tokenPreview}`,
        );
      } else {
        this.logger.warn(
          `Failed to record token refresh for user ${userId}: ${result.error}`,
        );
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error recording token refresh for user ${userId}: ${errorMsg}`);
      return {
        isSuccess: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Revocar una sesión (marcarla como REVOKED)
   * @param userId ID del usuario
   * @param reason Motivo de la revocación (para logging)
   * @returns Resultado de la actualización
   */
  async revokeSession(
    userId: string,
    reason?: string,
  ): Promise<ISessionOperationResult<ISession>> {
    try {
      const result = await this.sessionRepository.updateStatus(
        userId,
        SessionStatus.REVOKED,
      );

      if (result.isSuccess) {
        this.logger.log(
          `Session revoked for user ${userId}${reason ? `. Reason: ${reason}` : ''}`,
        );
      } else {
        this.logger.warn(`Failed to revoke session for user ${userId}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error revoking session for user ${userId}: ${errorMsg}`);
      return {
        isSuccess: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Buscar sesiones activas que han expirado y marcarlas como EXPIRED
   * Se usa típicamente en un scheduler que corre periódicamente
   * @returns Resultado con el número de sesiones marcadas como expiradas
   */
  async expireExpiredSessions(): Promise<{ isSuccess: boolean; count: number; error?: string }> {
    try {
      const result = await this.sessionRepository.findExpiredSessions();

      if (!result.isSuccess || !result.data) {
        this.logger.warn(`Error finding expired sessions: ${result.error}`);
        return {
          isSuccess: false,
          count: 0,
          error: result.error,
        };
      }

      let expiredCount = 0;

      for (const session of result.data) {
        const updateResult = await this.sessionRepository.updateStatus(
          session.userId,
          SessionStatus.EXPIRED,
        );

        if (updateResult.isSuccess) {
          expiredCount++;
        }
      }

      this.logger.log(`Marked ${expiredCount} sessions as EXPIRED`);

      return {
        isSuccess: true,
        count: expiredCount,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error expiring sessions: ${errorMsg}`);
      return {
        isSuccess: false,
        count: 0,
        error: errorMsg,
      };
    }
  }

  /**
   * Obtener sesión activa de un usuario
   * @param userId ID del usuario
   * @returns Resultado con la sesión (si existe)
   */
  async getActiveSession(userId: string): Promise<ISessionOperationResult<ISession>> {
    return this.sessionRepository.findByUserId(userId);
  }

  /**
   * Actualizar timestamp de última actividad
   * Útil para rastrear cuando fue el último acceso del usuario
   * @param userId ID del usuario
   * @returns Resultado de la actualización
   */
  async updateLastActivity(userId: string): Promise<ISessionOperationResult<ISession>> {
    return this.sessionRepository.updateLastActivity(userId);
  }

  /**
   * Extraer preview del token (primeros 5 + "..." + últimos 5 caracteres)
   * Esto mantiene la seguridad sin guardar el token completo
   * @param token Token completo
   * @returns Preview del token
   */
  private extractTokenPreview(token: string): string {
    if (token.length <= 10) {
      return token; // Si es muy corto, retornar como es
    }

    const start = token.substring(0, 5);
    const end = token.substring(token.length - 5);
    return `${start}...${end}`;
  }
}
