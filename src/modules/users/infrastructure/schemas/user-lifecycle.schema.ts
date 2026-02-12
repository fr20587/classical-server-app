import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

import { AbstractSchema } from 'src/common/schemas/abstract.schema';

import { UserStatus } from '../../domain/enums/enums';

export type UserLifecycleDocument = HydratedDocument<UserLifecycle>;

/**
 * Subdocumento para información del usuario que disparó la transición
 */
class TriggeredByInfo {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true })
  username!: string;

  @Prop({ type: String, required: true })
  roleKey!: string;
}

/**
 * Schema para registrar cada transición de estado en el ciclo de vida del usuario
 * Se usa para auditoría y trazabilidad
 *
 * Estados del usuario:
 * - INACTIVE: Estado inicial (recién registrado)
 * - ACTIVE: Teléfono verificado, usuario activo
 * - SUSPENDED: Incidencia detectada, cuenta suspendida
 * - DISABLED: Cierre definitivo de la cuenta
 */
@Schema({
  timestamps: false,
  collection: 'user_lifecycles',
  versionKey: false,
})
export class UserLifecycle extends AbstractSchema {
  /**
   * ID del usuario que cambió de estado
   */
  declare userId: string;

  /**
   * Estado anterior
   */
  @Prop({
    type: String,
    enum: Object.values(UserStatus),
    required: true,
  })
  fromState!: UserStatus;

  /**
   * Estado nuevo
   */
  @Prop({
    type: String,
    enum: Object.values(UserStatus),
    required: true,
  })
  toState!: UserStatus;

  /**
   * Información del usuario/administrador que disparó la transición
   */
  @Prop({
    type: Object,
    required: true,
  })
  triggeredBy!: TriggeredByInfo;

  /**
   * Motivo o comentario sobre la transición
   * Ej: "Actividad sospechosa detectada", "Solicitud de cierre de cuenta"
   */
  @Prop({
    type: String,
    required: false,
  })
  reason?: string;

  /**
   * Timestamp exacto de la transición
   */
  @Prop({
    type: Date,
    default: Date.now,
    required: true,
  })
  timestamp!: Date;

  /**
   * Snapshot completo de la máquina de estados en el momento de la transición
   * Usado para debugging y auditoría
   */
  @Prop({
    type: Object,
    required: false,
  })
  xstateSnapshot?: Record<string, any>;
}

export const UserLifecycleSchema =
  SchemaFactory.createForClass(UserLifecycle);

/**
 * Crear índices para optimización de queries
 */
UserLifecycleSchema.index({ userId: 1, timestamp: -1 });
UserLifecycleSchema.index({ toState: 1 });
UserLifecycleSchema.index({ timestamp: 1 });
