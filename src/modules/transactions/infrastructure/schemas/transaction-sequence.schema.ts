import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Schema: Almacena el próximo número secuencial para transacciones
 * Documento único con _id: 'transaction_no'
 * Se inicializa con nextNo: 1 en la primera creación
 */
@Schema({ collection: 'transaction_sequences', timestamps: false })
export class TransactionSequence extends Document {
  @Prop({ type: String, default: 'transaction_no', index: true })
  _id: string;

  @Prop({ type: Number, default: 1, min: 1 })
  nextNo: number;
}

export const TransactionSequenceSchema = SchemaFactory.createForClass(TransactionSequence);

// Índice único para garantizar que solo existe un documento
TransactionSequenceSchema.index({ _id: 1 }, { unique: true });
