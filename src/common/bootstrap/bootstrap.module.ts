import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { SystemBootstrapService } from './system-bootstrap.service';
import { ModuleSchemaFactory } from '../../modules/modules/infrastructure/schemas/module.schema';
import { RoleSchema } from '../../modules/roles/infrastructure/schemas/role.schema';
import { PermissionSchema } from '../../modules/authz/schemas/permission.schema';
import { UserSchema } from '../../modules/users/infrastructure/schemas/user.schema';

/**
 * BootstrapModule - Módulo para la inicialización del sistema
 *
 * Gestiona la creación de:
 * - Módulos del sistema
 * - Permisos
 * - Roles
 * - Super admin (primer usuario)
 *
 * Se ejecuta automáticamente al inicializar la aplicación
 * en onModuleInit con garantía de orden: módulos → permisos → roles → super_admin
 */
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      {
        name: 'Module',
        schema: ModuleSchemaFactory,
      },
      {
        name: 'Permission',
        schema: PermissionSchema,
      },
      {
        name: 'Role',
        schema: RoleSchema,
      },
      {
        name: 'User',
        schema: UserSchema,
      },
    ]),
  ],
  providers: [SystemBootstrapService],
  exports: [SystemBootstrapService],
})
export class BootstrapModule {}
