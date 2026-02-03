import { Injectable, Logger } from '@nestjs/common';
import { ITransactionsRepository } from '../../domain/ports/transactions.repository';
import { Transaction } from '../../domain/entities/transaction.entity';
import { Actor } from '../../../common/interfaces/actor.interface';
import { ListTransactionsQueryDto } from '../../dto/transactions.dto';

/**
 * Servicio de consulta para listar transacciones con filtrado inteligente
 * según el rol del usuario (actor)
 */
@Injectable()
export class TransactionQueryService {
  private readonly logger = new Logger(TransactionQueryService.name);

  constructor(private readonly transactionsRepository: ITransactionsRepository) {}

  /**
   * Lista transacciones con filtrado automático según roleKey del actor
   * - user: filtrar por customerId
   * - merchant: filtrar por tenantId
   * - otros roles: permitir query params (tenantId, customerId, etc)
   */
  async list(
    actor: Actor,
    query: ListTransactionsQueryDto,
    requestId: string,
  ): Promise<{ data: Transaction[]; total: number }> {
    this.logger.log(`[${requestId}] Listando transacciones para actor=${actor.actorId}, roleKey=${actor.roleKey}`);

    try {
      // Extraer roleKey del actor
      // Nota: Asumimos que Actor tiene un campo roleKey o lo obtenemos de scopes
      const roleKey = this.extractRoleKey(actor);

      // Construir filtros según el roleKey
      let filters: Record<string, any> = {
        skip: query.skip,
        take: query.take,
      };

      if (query.status) filters.status = query.status;
      if (query.dateFrom) filters.dateFrom = new Date(query.dateFrom);
      if (query.dateTo) filters.dateTo = new Date(query.dateTo);

      // Aplicar filtrado según rol
      if (roleKey === 'user') {
        // Usuario: solo sus propias transacciones
        filters.customerId = actor.actorId;
      } else if (roleKey === 'merchant') {
        // Merchant: transacciones de su tenant
        // TODO: Obtener tenantId del actor o contexto
        filters.tenantId = query.tenantId ?? this.getTenantIdFromActor(actor);
      } else {
        // Otros roles (admin, etc): permitir filtrar por params
        if (query.tenantId) filters.tenantId = query.tenantId;
        if (query.customerId) filters.customerId = query.customerId;
      }

      this.logger.debug(`[${requestId}] Filtros aplicados:`, filters);

      // Ejecutar query
      return await this.transactionsRepository.findAll(filters);
    } catch (error) {
      this.logger.error(`[${requestId}] Error listando transacciones: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene una transacción individual si el actor tiene permisos
   */
  async findOne(transactionId: string, actor: Actor, requestId: string): Promise<Transaction | null> {
    this.logger.log(`[${requestId}] Obteniendo transacción ${transactionId}`);

    try {
      const transaction = await this.transactionsRepository.findById(transactionId);
      if (!transaction) {
        return null;
      }

      // Validar permisos: user solo puede ver sus transacciones
      const roleKey = this.extractRoleKey(actor);
      if (roleKey === 'user' && transaction.customerId !== actor.actorId) {
        this.logger.warn(
          `[${requestId}] User ${actor.actorId} intentó acceder a transacción de otro cliente`,
        );
        return null; // Retornar null en lugar de error para no revelar existencia
      }

      // Merchant solo puede ver transacciones de su tenant
      if (roleKey === 'merchant') {
        const tenantId = this.getTenantIdFromActor(actor);
        if (transaction.tenantId !== tenantId) {
          this.logger.warn(
            `[${requestId}] Merchant ${actor.actorId} intentó acceder a transacción de otro tenant`,
          );
          return null;
        }
      }

      return transaction;
    } catch (error) {
      this.logger.error(`[${requestId}] Error obteniendo transacción: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extrae el roleKey del actor
   * El actor tiene un array de scopes que pueden contener información de rol
   * o tiene un campo roleKey específico
   */
  private extractRoleKey(actor: Actor): string {
    // TODO: Implementar lógica para extraer roleKey del actor
    // Por ahora asumimos que está disponible en actor.roleKey
    return (actor as any).roleKey ?? 'user';
  }

  /**
   * Obtiene el tenantId del actor
   * Usado para merchants que están asociados a un tenant específico
   */
  private getTenantIdFromActor(actor: Actor): string {
    // TODO: Implementar lógica para obtener tenantId del actor
    // Por ahora retorna un string vacío
    return (actor as any).tenantId ?? '';
  }
}
