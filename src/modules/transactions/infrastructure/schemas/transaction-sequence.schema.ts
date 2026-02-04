import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Schema: Almacena el próximo número secuencial para transacciones
 * Documento único con collectionName: 'transactions'
 * Se inicializa con nextNo: 1 en la primera creación
 */
@Schema({ collection: 'transaction_sequences', timestamps: false })
export class TransactionSequence extends Document {
  @Prop({ type: String, default: 'transactions' })
  collectionName: string;

  @Prop({ type: Number, default: 1, min: 1 })
  nextNo: number;
}


export const TransactionSequenceSchema = SchemaFactory.createForClass(TransactionSequence);

// Índice único para garantizar que solo existe un documento
TransactionSequenceSchema.index({ collectionName: 1 }, { unique: true });
