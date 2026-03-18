import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Schema: Almacena el próximo número secuencial para tenants
 * Documento único con collectionName: 'tenants'
 * Se inicializa con nextNo: 1 en la primera creación (upsert)
 */
@Schema({ collection: 'tenant_sequences', timestamps: false })
export class TenantSequence extends Document {
  @Prop({ type: String, default: 'tenants' })
  collectionName: string;

  @Prop({ type: Number, default: 1, min: 1 })
  nextNo: number;
}

export const TenantSequenceSchema = SchemaFactory.createForClass(TenantSequence);

TenantSequenceSchema.index({ collectionName: 1 }, { unique: true });
