import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import { SYSTEM_MODULES } from '../../modules/modules/seeds/system-modules';
import { SYSTEM_ROLES } from '../../modules/roles/seeds/system-roles';
import { SYSTEM_PERMISSIONS } from '../../modules/roles/seeds/system-permissions';
import { SYSTEM_ADMIN_ID } from '../../common/constants/system-constants';

/**
 * SystemBootstrapService - Orquestador central de inicialización
 *
 * Ejecuta la inicialización del sistema en FASES:
 * 1️⃣  Módulos (base para permisos)
 * 2️⃣  Permisos (base para roles)
 * 3️⃣  Roles (base para usuarios)
 * 4️⃣  Super Admin (primer usuario del sistema)
 *
 * Estrategia: Auto-seed inteligente
 * - Se ejecuta en onModuleInit SIEMPRE
 * - Verifica si cada colección está vacía
 * - Si está vacía → ejecuta seed correspondiente
 * - Si no está vacía → respeta datos preexistentes
 *
 * IMPORTANTE: El super_admin SOLO se crea si:
 * - La colección users está vacía
 * - SA_EMAIL y SA_PWD están configurados en env
 */
@Injectable()
export class SystemBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(SystemBootstrapService.name);

  constructor(
    @InjectModel('Module') private moduleModel: Model<any>,
    @InjectModel('Permission') private permissionModel: Model<any>,
    @InjectModel('Role') private roleModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>,
    private configService: ConfigService,
  ) {}

  /**
   * Hook del ciclo de vida de NestJS
   * Se ejecuta al inicializar el módulo
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('🚀 Starting system bootstrap initialization...');

    try {
      // FASE 1: Módulos
      await this.bootstrapModules();

      // FASE 2: Permisos
      await this.bootstrapPermissions();

      // FASE 3: Roles
      await this.bootstrapRoles();

      // FASE 4: Super Admin
      await this.bootstrapSuperAdmin();

      this.logger.log('✅ System bootstrap completed successfully');
    } catch (error) {
      this.logger.error(
        `❌ Error during system bootstrap: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // No lanzar error - permitir que la app inicie aunque falle el bootstrap
    }
  }

  /**
   * FASE 1: Inicializar módulos del sistema
   */
  private async bootstrapModules(): Promise<void> {
    this.logger.log('📦 PHASE 1: Bootstrap modules...');

    try {
      const modulesCount = await this.moduleModel.countDocuments().exec();

      if (modulesCount > 0) {
        this.logger.debug(
          `   Modules collection already has ${modulesCount} documents - skipping`,
        );
        return;
      }

      this.logger.log('   🌱 Modules collection is empty - seeding...');

      let seedCount = 0;
      for (const module of SYSTEM_MODULES) {
        try {
          this.logger.debug(`   • Seeding module: ${module.name}`);

          const createData = {
            name: module.name,
            parent: module.parent,
            order: module.order,
            indicator: module.indicator,
            description: module.description,
            icon: module.icon,
            actions: module.actions,
            permissions: module.permissions,
            status: 'active',
            isSystem: true,
          };

          await this.moduleModel.updateOne(
            { indicator: module.indicator },
            {
              $set: createData,
              $setOnInsert: {
                createdAt: new Date(),
              },
            },
            { upsert: true },
          );

          seedCount++;
        } catch (error) {
          this.logger.warn(
            `   ⚠ Error seeding module '${module.name}': ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      this.logger.log(
        `   ✅ PHASE 1 completed: ${seedCount}/${SYSTEM_MODULES.length} modules seeded`,
      );
    } catch (error) {
      this.logger.error(
        `   ❌ Error in PHASE 1: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * FASE 2: Inicializar permisos del sistema
   */
  private async bootstrapPermissions(): Promise<void> {
    this.logger.log('🔐 PHASE 2: Bootstrap permissions...');

    try {
      const permissionsCount = await this.permissionModel
        .countDocuments()
        .exec();

      if (permissionsCount > 0) {
        this.logger.debug(
          `   Permissions collection already has ${permissionsCount} documents - skipping`,
        );
        return;
      }

      this.logger.log('   🌱 Permissions collection is empty - seeding...');

      let seedCount = 0;
      for (const permission of SYSTEM_PERMISSIONS) {
        try {
          this.logger.debug(`   • Seeding permission: ${permission.key}`);

          const createData = {
            key: permission.key,
            description: permission.description,
            resource: permission.resource,
            action: permission.action,
            status: 'active',
            isSystem: true,
          };

          await this.permissionModel.updateOne(
            { key: permission.key },
            {
              $set: createData,
              $setOnInsert: {
                createdAt: new Date(),
              },
            },
            { upsert: true },
          );

          seedCount++;
        } catch (error) {
          this.logger.warn(
            `   ⚠ Error seeding permission '${permission.key}': ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      this.logger.log(
        `   ✅ PHASE 2 completed: ${seedCount}/${SYSTEM_PERMISSIONS.length} permissions seeded`,
      );
    } catch (error) {
      this.logger.error(
        `   ❌ Error in PHASE 2: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * FASE 3: Inicializar roles del sistema
   */
  private async bootstrapRoles(): Promise<void> {
    this.logger.log('👥 PHASE 3: Bootstrap roles...');

    try {
      const rolesCount = await this.roleModel.countDocuments().exec();

      if (rolesCount > 0) {
        this.logger.debug(
          `   Roles collection already has ${rolesCount} documents - skipping`,
        );
        return;
      }

      this.logger.log('   🌱 Roles collection is empty - seeding...');

      let seedCount = 0;
      for (const role of SYSTEM_ROLES) {
        try {
          this.logger.debug(`   • Seeding role: ${role.key}`);

          const createData = {
            key: role.key,
            name: role.name,
            description: role.description,
            permissionKeys: role.permissionKeys,
            status: role.status,
            isSystem: true,
          };

          await this.roleModel.updateOne(
            { key: role.key },
            {
              $set: createData,
              $setOnInsert: {
                createdAt: new Date(),
              },
            },
            { upsert: true },
          );

          seedCount++;
        } catch (error) {
          this.logger.warn(
            `   ⚠ Error seeding role '${role.key}': ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      this.logger.log(
        `   ✅ PHASE 3 completed: ${seedCount}/${SYSTEM_ROLES.length} roles seeded`,
      );
    } catch (error) {
      this.logger.error(
        `   ❌ Error in PHASE 3: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * FASE 4: Inicializar super_admin como primer usuario
   *
   * IMPORTANTE:
   * - Se ejecuta SOLO si la colección users está vacía
   * - Requiere SA_EMAIL y SA_PWD configurados
   * - Crea usuario con rol 'super_admin'
   * - Usa SYSTEM_ADMIN_ID como id del documento
   */
  private async bootstrapSuperAdmin(): Promise<void> {
    this.logger.log('👨‍💼 PHASE 4: Bootstrap super admin user...');

    try {
      const usersCount = await this.userModel.countDocuments().exec();

      if (usersCount > 0) {
        this.logger.debug(
          `   Users collection already has ${usersCount} documents - skipping`,
        );
        return;
      }

      this.logger.log(
        '   🌱 Users collection is empty - creating super_admin...',
      );

      // Obtener credenciales del super admin desde configuración
      const saEmail = this.configService.get<string>('SA_EMAIL');
      const saPwd = this.configService.get<string>('SA_PWD');

      if (!saEmail || !saPwd) {
        this.logger.warn(
          '   ⚠ SA_EMAIL or SA_PWD not configured - skipping super_admin creation',
        );
        return;
      }

      // Hash de la contraseña
      const passwordHash = await argon2.hash(saPwd);

      // Crear super_admin
      const superAdminId = SYSTEM_ADMIN_ID;

      await this.userModel.create({
        id: superAdminId,
        userId: superAdminId,
        email: saEmail,
        fullname: 'Super Administrator',
        idNumber: '00000000000',
        phone: '00000000',
        passwordHash,
        roleKey: 'super_admin',
        status: 'active',
        isSystemAdmin: true,
        createdAt: new Date(),
      });

      this.logger.log(
        `   ✅ PHASE 4 completed: Super admin created (${superAdminId} - ${saEmail})`,
      );
    } catch (error) {
      this.logger.error(
        `   ❌ Error in PHASE 4: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
