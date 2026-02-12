import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditModule } from '../audit/audit.module';
// import { PermissionsModule } from '../permissions/permissions.module';

import { AsyncContextService } from 'src/common/context/async-context.service';
import { UsersService } from './application/users.service';

import { UsersController } from './infrastructure/controllers/users.controller';
import { ProfileController } from './infrastructure/controllers/profile.controller';

import { UsersRepository } from './infrastructure/adapters/users.repository';
import { UserLifecycleRepository } from './infrastructure/adapters/user-lifecycle.repository';

import { User, UserSchema } from './infrastructure/schemas/user.schema';
import { UserLifecycle, UserLifecycleSchema } from './infrastructure/schemas/user-lifecycle.schema';

/**
 * Módulo de gestión de usuarios.
 *
 * Proporciona servicios CRUD y controladores REST para usuarios.
 * Todas las operaciones relacionadas con usuarios están centralizadas aquí.
 *
 * Servicios:
 * - UsersService: CRUD básico con validaciones, máquina de estados y encapsulación de Argon2
 * - UsersRepository: Adaptador MongoDB implementando patrón Repository
 * - UserLifecycleRepository: Adaptador MongoDB para historial de ciclo de vida
 *
 * Controladores:
 * - UsersController: Endpoints REST protegidos por JWT y permisos
 *   - POST /users - Crear usuario
 *   - GET /users - Listar usuarios
 *   - GET /users/:userId - Obtener usuario
 *   - POST /users/:userId/roles - Actualizar roles
 *   - POST /users/:userId/password - Cambiar contraseña
 *   - PATCH /users/:userId - Actualizar datos
 *   - DELETE /users/:userId - Deshabilitar usuario
 *   - POST /users/:userId/transition - Cambiar estado del usuario
 *   - GET /users/:userId/lifecycle - Obtener historial de cambios de estado
 *
 * Eventos:
 * - user.created: Emitido al crear usuario
 * - user.password_changed: Emitido al cambiar contraseña
 * - user.state_transitioned: Emitido al cambiar estado del usuario
 *
 * Máquina de estados:
 * - INACTIVE (estado inicial) → ACTIVE (verificación de teléfono)
 * - ACTIVE → SUSPENDED (reporte de incidencia)
 * - SUSPENDED → ACTIVE (incidencia resuelta)
 * - {INACTIVE | ACTIVE | SUSPENDED} → DISABLED (cierre definitivo)
 *
 * Exportaciones:
 * - UsersService: Para acceso desde otros módulos
 * - UsersRepository: Para acceso desde otros módulos
 * - UserLifecycleRepository: Para acceso desde otros módulos
 * - MongooseModule: Para extensiones de esquema
 */
@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserLifecycle.name, schema: UserLifecycleSchema },
    ]),
    // PermissionsModule,
  ],
  controllers: [UsersController, ProfileController],
  providers: [AsyncContextService, UsersService, UsersRepository, UserLifecycleRepository],
  exports: [MongooseModule, UsersService, UsersRepository, UserLifecycleRepository],
})
export class UsersModule {}
