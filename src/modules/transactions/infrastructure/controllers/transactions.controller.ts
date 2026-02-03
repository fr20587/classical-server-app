import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  HttpStatus,
  HttpCode,
  Logger,
  UseGuards,
  UseInterceptors,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Actor } from '../../../common/interfaces/actor.interface';
import { GetActor } from '../../../common/interceptors/authentication.interceptor';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';
import { ContextInterceptor } from '../../../common/interceptors/context.interceptor';
import { ApiResponse } from '../../../common/types/api-response.type';
import { TransactionService } from '../../application/services/transaction.service';
import { TransactionQueryService } from '../../application/services/transaction-query.service';
import {
  CreateTransactionDto,
  ConfirmTransactionDto,
  ListTransactionsQueryDto,
  CreateTransactionResponseDto,
} from '../../dto/transactions.dto';
import { Transaction } from '../../domain/entities/transaction.entity';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

/**
 * Controlador de transacciones
 * Endpoints para crear, confirmar, cancelar y listar transacciones
 */
@Controller('transactions')
@UseInterceptors(ContextInterceptor, AuditInterceptor)
@UseGuards(AuthGuard('jwt'))
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(
    private readonly transactionService: TransactionService,
    private readonly transactionQueryService: TransactionQueryService,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  /**
   * Crea una nueva transacción
   * POST /transactions
   * Body: { tenantId, customerId, ref, amount, ttlMinutes? }
   * Response: { id, ref, no, amount, expiresAt, payload, signature }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @GetActor() actor: Actor,
    @Body() dto: CreateTransactionDto,
  ): Promise<ApiResponse<CreateTransactionResponseDto>> {
    const requestId = (this.request as any).id;
    this.logger.log(`[${requestId}] POST /transactions - Actor: ${actor.actorId}`);

    const result = await this.transactionService.create(dto, requestId);

    return ApiResponse.ok(HttpStatus.CREATED, result, 'Transacción creada exitosamente', {
      requestId,
    });
  }

  /**
   * Confirma una transacción con cardId y firma
   * POST /transactions/:id/confirm
   * Body: { cardId, signature }
   * Response: Transaction completa
   */
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @GetActor() actor: Actor,
    @Param('id') transactionId: string,
    @Body() dto: ConfirmTransactionDto,
  ): Promise<ApiResponse<Transaction>> {
    const requestId = (this.request as any).id;
    this.logger.log(`[${requestId}] POST /transactions/:id/confirm - Transaction: ${transactionId}`);

    const result = await this.transactionService.confirm(transactionId, dto, requestId);

    return ApiResponse.ok(HttpStatus.OK, result, 'Transacción confirmada exitosamente', {
      requestId,
    });
  }

  /**
   * Cancela una transacción
   * POST /transactions/:id/cancel
   * Response: Transaction actualizada
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @GetActor() actor: Actor,
    @Param('id') transactionId: string,
  ): Promise<ApiResponse<Transaction>> {
    const requestId = (this.request as any).id;
    this.logger.log(`[${requestId}] POST /transactions/:id/cancel - Transaction: ${transactionId}`);

    const result = await this.transactionService.cancel(transactionId, requestId);

    return ApiResponse.ok(HttpStatus.OK, result, 'Transacción cancelada exitosamente', {
      requestId,
    });
  }

  /**
   * Lista transacciones con filtrado inteligente por rol
   * GET /transactions?status=new&tenantId=...&skip=0&take=20
   *
   * Filtrado por roleKey del usuario:
   * - user: solo sus propias transacciones (customerId)
   * - merchant: transacciones de su tenant
   * - admin/otros: puede filtrar por cualquier parámetro
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @GetActor() actor: Actor,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<ApiResponse<{ data: Transaction[]; total: number; meta: any }>> {
    const requestId = (this.request as any).id;
    this.logger.log(`[${requestId}] GET /transactions - Actor: ${actor.actorId}`);

    const result = await this.transactionQueryService.list(actor, query, requestId);

    return ApiResponse.ok(
      HttpStatus.OK,
      { ...result, meta: { skip: query.skip, take: query.take } },
      'Transacciones listadas',
      { requestId },
    );
  }

  /**
   * Obtiene detalles de una transacción específica
   * GET /transactions/:id
   * Response: Transaction completa (con validación de permisos)
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @GetActor() actor: Actor,
    @Param('id') transactionId: string,
  ): Promise<ApiResponse<Transaction | null>> {
    const requestId = (this.request as any).id;
    this.logger.log(`[${requestId}] GET /transactions/:id - Transaction: ${transactionId}`);

    const result = await this.transactionQueryService.findOne(transactionId, actor, requestId);

    if (!result) {
      return ApiResponse.fail(
        HttpStatus.NOT_FOUND,
        'Transacción no encontrada',
        'No tienes permisos para ver esta transacción o no existe',
        { requestId },
      );
    }

    return ApiResponse.ok(HttpStatus.OK, result, 'Transacción encontrada', { requestId });
  }
}
