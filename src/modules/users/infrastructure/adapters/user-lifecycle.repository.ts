import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { UserLifecycle, UserLifecycleDocument } from '../schemas/user-lifecycle.schema';

/**
 * Evento de ciclo de vida de usuario
 */
export interface UserLifecycleEvent {
  userId: string;
  fromState: string;
  toState: string;
  triggeredBy: {
    userId: string;
    username: string;
    roleKey: string;
  };
  reason?: string;
  timestamp: Date;
  xstateSnapshot?: Record<string, any>;
}

/**
 * Respuesta de evento de ciclo de vida
 */
export interface UserLifecycleEventResponseDto {
  id: string;
  userId: string;
  fromState: string;
  toState: string;
  triggeredBy: {
    userId: string;
    username: string;
    roleKey: string;
  };
  reason?: string;
  timestamp: Date;
}

/**
 * Respuesta paginada de ciclo de vida
 */
export interface UserLifecyclePaginatedResponseDto {
  events: UserLifecycleEventResponseDto[];
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalCount: number;
  };
}

/**
 * Adaptador MongoDB para UserLifecycle.
 * Implementa el patrón Repository, aislando la lógica de persistencia.
 */
@Injectable()
export class UserLifecycleRepository {
  private readonly logger = new Logger(UserLifecycleRepository.name);

  constructor(
    @InjectModel(UserLifecycle.name)
    private userLifecycleModel: Model<UserLifecycleDocument>,
  ) {}

  /**
   * Crear un evento de ciclo de vida
   */
  async create(event: UserLifecycleEvent): Promise<UserLifecycle> {
    try {
      const lifecycleEvent = await this.userLifecycleModel.create(event);
      this.logger.log(
        `Lifecycle event created for user ${event.userId}: ${event.fromState} → ${event.toState}`,
      );
      return lifecycleEvent;
    } catch (error: any) {
      this.logger.error(
        `Error creating lifecycle event: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Obtener historial de ciclo de vida de un usuario con paginación
   */
  async findByUserId(
    userId: string,
    pagination?: { page: number; limit: number },
  ): Promise<{
    events: UserLifecycle[];
    total: number;
  }> {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const skip = (page - 1) * limit;

      const [events, total] = await Promise.all([
        this.userLifecycleModel
          .find({ userId })
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.userLifecycleModel.countDocuments({ userId }).exec(),
      ]);

      this.logger.log(
        `Found ${events.length} lifecycle events for user ${userId}`,
      );

      return {
        events: events as UserLifecycle[],
        total,
      };
    } catch (error: any) {
      this.logger.error(
        `Error finding lifecycle events: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Obtener el último evento de transición de un usuario
   */
  async findLastByUserId(userId: string): Promise<UserLifecycle | null> {
    try {
      return this.userLifecycleModel
        .findOne({ userId })
        .sort({ timestamp: -1 })
        .lean()
        .exec();
    } catch (error: any) {
      this.logger.error(
        `Error finding last lifecycle event: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Obtener historial completo de ciclo de vida de un usuario (sin paginación)
   */
  async findAllByUserId(userId: string): Promise<UserLifecycle[]> {
    try {
      return this.userLifecycleModel
        .find({ userId })
        .sort({ timestamp: -1 })
        .lean()
        .exec();
    } catch (error: any) {
      this.logger.error(
        `Error finding all lifecycle events: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Obtener eventos de transición a un estado específico
   */
  async findByUserIdAndToState(
    userId: string,
    toState: string,
  ): Promise<UserLifecycle[]> {
    try {
      return this.userLifecycleModel
        .find({ userId, toState })
        .sort({ timestamp: -1 })
        .lean()
        .exec();
    } catch (error: any) {
      this.logger.error(
        `Error finding lifecycle events by state: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Contar eventos por estado destino
   */
  async countByToState(toState: string): Promise<number> {
    try {
      return this.userLifecycleModel.countDocuments({ toState }).exec();
    } catch (error: any) {
      this.logger.error(
        `Error counting lifecycle events: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
      throw error;
    }
  }
}
