import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AbstractSchema } from 'src/common/schemas/abstract.schema';
import type { UserDTO } from 'src/modules/users/domain/ports/users.port';
import { SessionStatus, ISessionTokenUpdate } from '../../domain/models/session.model';

export type SessionDocument = HydratedDocument<Session>;

@Schema({ timestamps: true, collection: 'sessions' })
export class Session extends AbstractSchema {
  @Prop({ type: String, required: true, ref: 'User', index: true })
  declare userId: string;

  @Prop({
    type: Object,
    required: true,
    description: 'Snapshot del usuario al momento del login (para auditoría)',
  })
  user: UserDTO;

  @Prop({
    type: String,
    enum: Object.values(SessionStatus),
    default: SessionStatus.ACTIVE,
    index: true,
  })
  status: SessionStatus;

  @Prop({ type: Date, required: true })
  loginTimestamp: Date;

  @Prop({ type: Date, required: true, default: Date.now })
  lastActivityTime: Date;

  @Prop({
    type: [
      {
        timestamp: { type: Date, required: true },
        tokenPreview: { type: String, required: true },
      },
    ],
    default: [],
  })
  tokenUpdates: ISessionTokenUpdate[];

  @Prop({
    type: Date,
    required: true,
    index: true,
    description: 'Fecha cuando expira la sesión (normalmente 7 días desde login)',
  })
  expiresAt: Date;

  @Prop({ type: String, required: false })
  ipAddress?: string;

  @Prop({ type: String, required: false })
  userAgent?: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

/**
 * Crear índices compuestos para optimización de consultas
 */
SessionSchema.index({ userId: 1, status: 1 });
SessionSchema.index({ expiresAt: 1, status: 1 });

/**
 * TTL index: MongoDB eliminará automáticamente documentos 0 segundos después de expiresAt
 * Esto es opcional pero recomendado para limpieza automática
 */
// SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
