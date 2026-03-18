import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantSequence } from '../schemas/tenant-sequence.schema';

/**
 * Adapter para generar códigos secuenciales de tenants
 * Usa operación atómica findOneAndUpdate para garantizar incremento seguro
 */
@Injectable()
export class TenantSequenceAdapter {
  private readonly logger = new Logger(TenantSequenceAdapter.name);

  constructor(
    @InjectModel(TenantSequence.name)
    private readonly sequenceModel: Model<TenantSequence>,
  ) {}

  /**
   * Obtiene el próximo código secuencial para tenants
   * Formato: string de 8 dígitos zero-padded (e.g., "00000001")
   * Operación atómica: garantiza que no hay duplicados incluso con concurrencia
   */
  async getNextTenantCode(): Promise<string> {
    try {
      const result = await this.sequenceModel.findOneAndUpdate(
        { collectionName: 'tenants' },
        { $inc: { nextNo: 1 } },
        {
          new: true,
          upsert: true,
        },
      );

      return result.nextNo.toString().padStart(8, '0');
    } catch (error: any) {
      this.logger.error(`Error obteniendo próximo código de tenant: ${error.message}`);
      throw error;
    }
  }
}
