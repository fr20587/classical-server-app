import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { INJECTION_TOKENS } from 'src/common/constants/injection-tokens';
import { AuditService } from 'src/modules/audit/application/audit.service';

import { CardsRepository } from 'src/modules/cards/infrastructure/adapters/card.repository';
import { CardVaultAdapter } from 'src/modules/cards/infrastructure/adapters/card-vault.adapter';
import type { ISgtCardPort } from 'src/modules/cards/domain/ports/sgt-card.port';
import { TRANSFER_CODES } from 'src/modules/cards/domain/constants/transfer-codes.constant';
import { CardStatusEnum } from 'src/modules/cards/domain/enums/card-status.enum';

import { TenantsRepository } from 'src/modules/tenants/infrastructure/adapters/tenant.repository';
import { TenantVaultService } from 'src/modules/tenants/infrastructure/services/tenant-vault.service';

import { UsersRepository } from 'src/modules/users/infrastructure/adapters';

import { TransactionsRepository } from '../../infrastructure/adapters/transactions.repository';
import { TransactionConfirmedEvent, TransactionProcessedEvent } from '../../domain/events/transaction.events';
import { TransactionStatus } from '../../domain/entities/transaction.entity';

/**
 * Procesador de pagos para transacciones confirmadas
 * Escucha el evento transaction.confirmed y ejecuta la transferencia contra el SGT
 *
 * Flujo:
 * 1. Obtener datos de la transacción, tarjeta, usuario y tenant
 * 2. Recuperar secretos de Vault (PAN de tarjeta, PAN del tenant)
 * 3. Llamar al SGT /transfer
 * 4. Actualizar estado de la transacción según respuesta
 * 5. Emitir evento transaction.processed
 */
@Injectable()
export class TransactionPaymentProcessor {
  private readonly logger = new Logger(TransactionPaymentProcessor.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly cardsRepository: CardsRepository,
    private readonly cardVaultAdapter: CardVaultAdapter,
    private readonly eventEmitter: EventEmitter2,
    @Inject(INJECTION_TOKENS.CARD_SGT_PORT)
    private readonly sgtCardPort: ISgtCardPort,
    private readonly tenantsRepository: TenantsRepository,
    private readonly tenantVaultService: TenantVaultService,
    private readonly transactionsRepository: TransactionsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  /**
   * Procesa el pago cuando una transacción es confirmada por el usuario
   */
  @OnEvent('transaction.confirmed')
  async handleTransactionConfirmed(event: TransactionConfirmedEvent): Promise<void> {
    const { transactionId, tenantId, customerId, cardId } = event;

    this.logger.log(
      `Procesando pago para transacción=${transactionId}, card=${cardId}, tenant=${tenantId}`,
    );

    try {
      // Step 1: Obtener la transacción
      const transaction = await this.transactionsRepository.findById(transactionId);
      if (!transaction) {
        this.logger.error(`Transacción no encontrada: ${transactionId}`);
        return;
      }

      // Step 2: Obtener la tarjeta y validar que esté activa
      const card = await this.cardsRepository.findById(cardId);
      if (!card) {
        await this.failTransaction(transactionId, tenantId, 'Tarjeta no encontrada');
        return;
      }

      if (card.status !== CardStatusEnum.ACTIVE) {
        await this.failTransaction(transactionId, tenantId, `Tarjeta no activa: ${card.status}`);
        return;
      }

      if (!card.token) {
        await this.failTransaction(transactionId, tenantId, 'Tarjeta sin token SGT');
        return;
      }

      // Step 3: Obtener pinblock de la tarjeta desde Vault
      const pinblockResult = await this.cardVaultAdapter.getPinblock(cardId);
      if (pinblockResult.isFailure) {
        await this.failTransaction(transactionId, tenantId, 'Error al recuperar pinblock de Vault');
        return;
      }

      // Step 4: Obtener datos del usuario (idNumber)
      const user = await this.usersRepository.findByIdRaw(customerId);
      if (!user) {
        await this.failTransaction(transactionId, tenantId, 'Usuario no encontrado');
        return;
      }

      // Step 5: Obtener datos del tenant y su PAN (cuenta beneficiaria)
      const tenant = await this.tenantsRepository.findById(tenantId);
      if (!tenant) {
        await this.failTransaction(transactionId, tenantId, 'Tenant no encontrado');
        return;
      }

      const tenantPanResult = await this.tenantVaultService.getPan(tenantId);
      if (tenantPanResult.isFailure) {
        await this.failTransaction(transactionId, tenantId, 'Error al recuperar PAN del tenant');
        return;
      }

      const beneficiaryAccount = tenantPanResult.getValue();

      // Step 6: Formatear datos para SGT
      // El amount en la entidad viene en dólares (mapToDomain hace * 0.01)
      // SGT espera 12 dígitos donde los últimos 2 son decimales (centavos)
      const amountCents = Math.round(transaction.amount * 100);

      // cardholderAmount = 2.5% del amount (comisión de la pasarela, en centavos)
      const cardholderAmountCents = Math.round(amountCents * 0.025);
      // settlementAmount = amount - cardholderAmount (lo que recibe el beneficiario)
      const settlementAmountCents = amountCents - cardholderAmountCents;

      const formattedAmount = amountCents.toString().padStart(12, '0');
      const formattedSettlementAmount = settlementAmountCents.toString().padStart(12, '0');
      const formattedCardholderAmount = cardholderAmountCents.toString().padStart(12, '0');

      // merchantId: código del tenant padded a 15 caracteres
      const merchantId = (tenant.code || tenant.nit).padStart(15, '0');

      // clientReference: usar el ID de la transacción como referencia anti-replay
      const clientReference = `TXN-${transaction.id}`;

      this.logger.log(
        `Llamando SGT /transfer: amount=${formattedAmount}, settlement=${formattedSettlementAmount}, commission=${formattedCardholderAmount}, merchant=${merchantId}, ref=${clientReference}`,
      );

      // Step 7: Llamar al SGT /transfer (se usa el token para decodificar el pinblock ISO-4)
      const transferResult = await this.sgtCardPort.transfer({
        token: card.token,
        pin: pinblockResult.getValue(),
        amount: formattedAmount,
        settlementAmount: formattedSettlementAmount,
        cardholderAmount: formattedCardholderAmount,
        beneficiaryAccount,
        clientReference,
        type: 'payment',
        merchantId,
        idNumber: user.idNumber,
      });

      if (transferResult.isFailure) {
        const error = transferResult.getError();
        this.logger.error(
          `SGT /transfer falló para transacción=${transactionId}: ${error.message}`,
        );

        await this.failTransaction(transactionId, tenantId, error.message);
        return;
      }

      const sgtResponse = transferResult.getValue();
      const transferCode = sgtResponse.data?.transferCode;

      this.logger.log(
        `SGT /transfer respondió para transacción=${transactionId}: transferCode=${transferCode}`,
      );

      // Step 8: Evaluar código de transferencia
      const isSuccess =
        transferCode === TRANSFER_CODES.TR000.code ||
        transferCode === TRANSFER_CODES.TR002.code;

      if (isSuccess) {
        // Actualizar transacción a SUCCESS
        await this.transactionsRepository.updateStatus(
          transactionId,
          TransactionStatus.SUCCESS,
          {
            processedAt: new Date(),
            sgtTransferCode: transferCode,
            sgtIsoResponseCode: sgtResponse.data?.isoResponseCode,
          },
        );

        // Actualizar balance de la tarjeta si viene en la respuesta
        if (sgtResponse.data?.balance) {
          const newBalance = (parseInt(sgtResponse.data.balance, 10) || 0) / 100;
          await this.cardsRepository.update(cardId, { balance: newBalance });
        }

        this.logger.log(`Transacción ${transactionId} procesada exitosamente`);

        // Auditar
        this.auditService.logAllow('TRANSACTION_PAYMENT_SUCCESS', 'transaction', transactionId, {
          module: 'transactions',
          severity: 'MEDIUM',
          tags: ['transactions', 'payment', 'success'],
          actorId: customerId,
          changes: {
            after: {
              status: TransactionStatus.SUCCESS,
              transferCode,
              isoResponseCode: sgtResponse.data?.isoResponseCode,
            },
          },
        });

        // Emitir evento de transacción procesada
        this.eventEmitter.emit(
          'transaction.processed',
          new TransactionProcessedEvent(transactionId, tenantId, 'success'),
        );
      } else {
        // Transferencia rechazada o error de comunicación
        const transferCodeInfo = TRANSFER_CODES[transferCode as keyof typeof TRANSFER_CODES];
        const errorMsg = transferCodeInfo?.message || `Código SGT desconocido: ${transferCode}`;

        await this.transactionsRepository.updateStatus(
          transactionId,
          TransactionStatus.FAILED,
          {
            processedAt: new Date(),
            sgtTransferCode: transferCode,
            sgtIsoResponseCode: sgtResponse.data?.isoResponseCode,
          },
        );

        this.logger.warn(`Transacción ${transactionId} falló: ${errorMsg}`);

        this.auditService.logAllow('TRANSACTION_PAYMENT_FAILED', 'transaction', transactionId, {
          module: 'transactions',
          severity: 'HIGH',
          tags: ['transactions', 'payment', 'failed'],
          actorId: customerId,
          changes: {
            after: {
              status: TransactionStatus.FAILED,
              transferCode,
              isoResponseCode: sgtResponse.data?.isoResponseCode,
              error: errorMsg,
            },
          },
        });

        this.eventEmitter.emit(
          'transaction.processed',
          new TransactionProcessedEvent(transactionId, tenantId, 'failed', errorMsg),
        );
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error procesando pago para transacción=${transactionId}: ${errorMsg}`,
        error,
      );

      await this.failTransaction(transactionId, tenantId, errorMsg).catch((e) => {
        this.logger.error(`Error actualizando transacción fallida: ${e.message}`);
      });
    }
  }

  /**
   * Marca una transacción como fallida y emite el evento correspondiente
   */
  private async failTransaction(
    transactionId: string,
    tenantId: string,
    errorMsg: string,
  ): Promise<void> {
    await this.transactionsRepository.updateStatus(
      transactionId,
      TransactionStatus.FAILED,
      { processedAt: new Date() },
    );

    this.auditService.logError(
      'TRANSACTION_PAYMENT_ERROR',
      'transaction',
      transactionId,
      new Error(errorMsg),
      {
        module: 'transactions',
        severity: 'HIGH',
        tags: ['transactions', 'payment', 'error'],
      },
    );

    this.eventEmitter.emit(
      'transaction.processed',
      new TransactionProcessedEvent(transactionId, tenantId, 'failed', errorMsg),
    );
  }
}
