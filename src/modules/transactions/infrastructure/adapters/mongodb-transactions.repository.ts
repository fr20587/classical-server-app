import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction } from '../../domain/entities/transaction.entity';
import { ITransactionsRepository } from '../../domain/ports/transactions.repository';
import { TransactionSchema } from '../schemas/transaction.schema';
import { TransactionStatus } from '../../domain/entities/transaction.entity';

/**
 * Adapter: Implementación de repositorio de transacciones con MongoDB
 */
@Injectable()
export class MongoDbTransactionsRepository implements ITransactionsRepository {
  private readonly logger = new Logger(MongoDbTransactionsRepository.name);

  constructor(
    @InjectModel(TransactionSchema.name)
    private readonly transactionModel: Model<TransactionSchema>,
  ) {}

  async create(transaction: Transaction): Promise<Transaction> {
    try {
      const created = await this.transactionModel.create({
        ...transaction,
      });
      return this.mapToDomain(created);
    } catch (error) {
      this.logger.error(`Error creando transacción: ${error.message}`);
      throw error;
    }
  }

  async findById(id: string): Promise<Transaction | null> {
    try {
      const document = await this.transactionModel.findOne({ id });
      return document ? this.mapToDomain(document) : null;
    } catch (error) {
      this.logger.error(`Error buscando transacción por ID: ${error.message}`);
      throw error;
    }
  }

  async findByRef(ref: string, tenantId: string): Promise<Transaction | null> {
    try {
      const document = await this.transactionModel.findOne({ ref, tenantId });
      return document ? this.mapToDomain(document) : null;
    } catch (error) {
      this.logger.error(`Error buscando transacción por ref: ${error.message}`);
      throw error;
    }
  }

  async findByTenantId(
    tenantId: string,
    query?: { status?: string; skip?: number; take?: number },
  ): Promise<{ data: Transaction[]; total: number }> {
    try {
      const filter: Record<string, any> = { tenantId };
      if (query?.status) filter.status = query.status;

      const skip = query?.skip ?? 0;
      const take = query?.take ?? 20;

      const [documents, total] = await Promise.all([
        this.transactionModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take).exec(),
        this.transactionModel.countDocuments(filter),
      ]);

      return {
        data: documents.map((doc) => this.mapToDomain(doc)),
        total,
      };
    } catch (error) {
      this.logger.error(`Error listando transacciones del tenant: ${error.message}`);
      throw error;
    }
  }

  async findByCustomerId(
    customerId: string,
    query?: { status?: string; skip?: number; take?: number },
  ): Promise<{ data: Transaction[]; total: number }> {
    try {
      const filter: Record<string, any> = { customerId };
      if (query?.status) filter.status = query.status;

      const skip = query?.skip ?? 0;
      const take = query?.take ?? 20;

      const [documents, total] = await Promise.all([
        this.transactionModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take).exec(),
        this.transactionModel.countDocuments(filter),
      ]);

      return {
        data: documents.map((doc) => this.mapToDomain(doc)),
        total,
      };
    } catch (error) {
      this.logger.error(`Error listando transacciones del cliente: ${error.message}`);
      throw error;
    }
  }

  async findAll(filters?: {
    tenantId?: string;
    customerId?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    skip?: number;
    take?: number;
  }): Promise<{ data: Transaction[]; total: number }> {
    try {
      const filter: Record<string, any> = {};

      if (filters?.tenantId) filter.tenantId = filters.tenantId;
      if (filters?.customerId) filter.customerId = filters.customerId;
      if (filters?.status) filter.status = filters.status;

      // Filtro de rango de fechas
      if (filters?.dateFrom || filters?.dateTo) {
        filter.createdAt = {};
        if (filters.dateFrom) filter.createdAt.$gte = filters.dateFrom;
        if (filters.dateTo) filter.createdAt.$lte = filters.dateTo;
      }

      const skip = filters?.skip ?? 0;
      const take = filters?.take ?? 20;

      const [documents, total] = await Promise.all([
        this.transactionModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take).exec(),
        this.transactionModel.countDocuments(filter),
      ]);

      return {
        data: documents.map((doc) => this.mapToDomain(doc)),
        total,
      };
    } catch (error) {
      this.logger.error(`Error listando transacciones: ${error.message}`);
      throw error;
    }
  }

  async updateStatus(id: string, status: string, updates?: Record<string, any>): Promise<Transaction | null> {
    try {
      const updateData = {
        status,
        updatedAt: new Date(),
        ...updates,
      };

      const updated = await this.transactionModel.findOneAndUpdate({ id }, updateData, { new: true });
      return updated ? this.mapToDomain(updated) : null;
    } catch (error) {
      this.logger.error(`Error actualizando estado de transacción: ${error.message}`);
      throw error;
    }
  }

  async update(id: string, updates: Partial<Transaction>): Promise<Transaction | null> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };

      const updated = await this.transactionModel.findOneAndUpdate({ id }, updateData, { new: true });
      return updated ? this.mapToDomain(updated) : null;
    } catch (error) {
      this.logger.error(`Error actualizando transacción: ${error.message}`);
      throw error;
    }
  }

  async findExpired(): Promise<Transaction[]> {
    try {
      const now = new Date();
      const documents = await this.transactionModel.find({
        status: TransactionStatus.NEW,
        expiresAt: { $lte: now },
      });

      return documents.map((doc) => this.mapToDomain(doc));
    } catch (error) {
      this.logger.error(`Error buscando transacciones expiradas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mapea documento de MongoDB a entidad de dominio
   */
  private mapToDomain(document: any): Transaction {
    return new Transaction({
      id: document.id,
      ref: document.ref,
      no: document.no,
      tenantId: document.tenantId,
      tenantName: document.tenantName,
      customerId: document.customerId,
      amount: document.amount,
      status: document.status,
      cardId: document.cardId,
      ttlMinutes: document.ttlMinutes,
      expiresAt: document.expiresAt,
      signature: document.signature,
      stateSnapshot: document.stateSnapshot,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  }
}
