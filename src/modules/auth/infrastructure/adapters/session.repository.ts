import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../schemas/session.schema';
import { ISessionPort } from '../../domain/ports/session.port';
import {
  ISession,
  ISessionOperationResult,
  SessionStatus,
} from '../../domain/models/session.model';

/**
 * Adaptador MongoDB para Sessions.
 * Implementa el patrón Repository, aislando la lógica de persistencia de sesiones.
 */
@Injectable()
export class SessionRepository implements ISessionPort {
  private readonly logger = new Logger(SessionRepository.name);

  constructor(@InjectModel(Session.name) private sessionModel: Model<SessionDocument>) {}

  /**
   * Crear una nueva sesión en la base de datos
   * @param sessionData Datos iniciales de la sesión
   * @returns Resultado con la sesión creada
   */
  async create(sessionData: Partial<ISession>): Promise<ISessionOperationResult<ISession>> {
    try {
      const newSession = await this.sessionModel.create({
        userId: sessionData.userId,
        user: sessionData.user,
        status: SessionStatus.ACTIVE,
        loginTimestamp: sessionData.loginTimestamp,
        lastActivityTime: new Date(),
        tokenUpdates: [],
        expiresAt: sessionData.expiresAt,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
      });

      this.logger.debug(
        `Session created for user ${sessionData.userId} with ID ${newSession.id}`,
      );

      return {
        isSuccess: true,
        data: newSession.toObject() as ISession,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error creating session for user ${sessionData.userId}: ${errorMsg}`);
      return {
        isSuccess: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Buscar sesión activa de un usuario por ID
   * @param userId ID del usuario
   * @returns Resultado con la sesión (si existe)
   */
  async findByUserId(userId: string): Promise<ISessionOperationResult<ISession>> {
    try {
      const session = await this.sessionModel
        .findOne({
          userId,
          status: SessionStatus.ACTIVE,
        })
        .exec();

      if (!session) {
        this.logger.debug(`No active session found for user ${userId}`);
        return {
          isSuccess: true,
          data: undefined,
        };
      }

      this.logger.debug(`Session found for user ${userId}`);
      return {
        isSuccess: true,
        data: session.toObject() as ISession,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error finding session for user ${userId}: ${errorMsg}`);
      return {
        isSuccess: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Agregar un nuevo registro de actualización de access token
   * @param userId ID del usuario
   * @param tokenPreview Preview del nuevo token (primeros 5 + "..." + últimos 5 caracteres)
   * @returns Resultado de la actualización
   */
  async updateTokenHistory(
    userId: string,
    tokenPreview: string,
  ): Promise<ISessionOperationResult<ISession>> {
    try {
      const session = await this.sessionModel
        .findOneAndUpdate(
          {
            userId,
            status: SessionStatus.ACTIVE,
          },
          {
            $push: {
              tokenUpdates: {
                timestamp: new Date(),
                tokenPreview,
              },
            },
            $set: {
              lastActivityTime: new Date(),
            },
          },
          { new: true },
        )
        .exec();

      if (!session) {
        this.logger.warn(`No active session found for user ${userId} to update token history`);
        return {
          isSuccess: false,
          error: `No active session found for user ${userId}`,
        };
      }

      this.logger.debug(
        `Token history updated for user ${userId}, total updates: ${session.tokenUpdates.length}`,
      );

      return {
        isSuccess: true,
        data: session.toObject() as ISession,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error updating token history for user ${userId}: ${errorMsg}`);
      return {
        isSuccess: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Cambiar estado de la sesión
   * @param userId ID del usuario
   * @param status Nuevo estado (REVOKED o EXPIRED)
   * @returns Resultado de la actualización
   */
  async updateStatus(
    userId: string,
    status: SessionStatus,
  ): Promise<ISessionOperationResult<ISession>> {
    try {
      const session = await this.sessionModel
        .findOneAndUpdate(
          { userId },
          {
            $set: {
              status,
              updatedAt: new Date(),
            },
          },
          { new: true },
        )
        .exec();

      if (!session) {
        this.logger.warn(`No session found for user ${userId} to update status`);
        return {
          isSuccess: false,
          error: `No session found for user ${userId}`,
        };
      }

      this.logger.debug(`Session status updated for user ${userId} to ${status}`);

      return {
        isSuccess: true,
        data: session.toObject() as ISession,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error updating session status for user ${userId}: ${errorMsg}`);
      return {
        isSuccess: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Buscar todas las sesiones activas que han expirado (expiresAt < ahora)
   * @returns Resultado con listado de sesiones expiradas
   */
  async findExpiredSessions(): Promise<ISessionOperationResult<ISession[]>> {
    try {
      const now = new Date();
      const expiredSessions = await this.sessionModel
        .find({
          status: SessionStatus.ACTIVE,
          expiresAt: { $lt: now },
        })
        .exec();

      this.logger.debug(`Found ${expiredSessions.length} expired sessions to mark as EXPIRED`);

      return {
        isSuccess: true,
        data: expiredSessions.map((session) => session.toObject() as ISession),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error finding expired sessions: ${errorMsg}`);
      return {
        isSuccess: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Actualizar el timestamp de última actividad
   * @param userId ID del usuario
   * @returns Resultado de la actualización
   */
  async updateLastActivity(userId: string): Promise<ISessionOperationResult<ISession>> {
    try {
      const session = await this.sessionModel
        .findOneAndUpdate(
          {
            userId,
            status: SessionStatus.ACTIVE,
          },
          {
            $set: {
              lastActivityTime: new Date(),
            },
          },
          { new: true },
        )
        .exec();

      if (!session) {
        this.logger.debug(`No active session found for user ${userId} to update last activity`);
        return {
          isSuccess: true,
          data: undefined,
        };
      }

      return {
        isSuccess: true,
        data: session.toObject() as ISession,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error updating last activity for user ${userId}: ${errorMsg}`);
      return {
        isSuccess: false,
        error: errorMsg,
      };
    }
  }
}
