import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { RoleStatus } from '../../domain/role.enums';
import { AbstractSchema } from 'src/common/schemas/abstract.schema';

export type RoleDocument = HydratedDocument<Role>;

@Schema({ timestamps: true, collection: 'roles' })
export class Role extends AbstractSchema {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  key: string;

  @Prop({ required: true, trim: true, type: String, maxlength: 100 })
  name: string;

  @Prop({ type: String, trim: true, maxlength: 20 })
  icon?: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  description?: string;

  @Prop({ type: Number, default: 0, min: 0 })
  assignedUsersCount?: number;

  @Prop({ required: true, type: [String], default: [] })
  permissionKeys: string[];

  @Prop({ required: true, default: false, immutable: true })
  isSystem: boolean;

  @Prop({
    required: true,
    enum: Object.values(RoleStatus),
    type: String,
    default: RoleStatus.ACTIVE,
  })
  status: RoleStatus;
}

export const RoleSchema = SchemaFactory.createForClass(Role);

// Índices adicionales
RoleSchema.index({ status: 1 });
RoleSchema.index({ isSystem: 1 });
RoleSchema.index({ permissionKeys: 1 });
