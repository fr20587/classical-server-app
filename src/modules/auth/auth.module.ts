import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

import { AuditModule } from '../audit/audit.module';
import { CachingModule } from 'src/common/cache/cache.module';
import { CardsModule } from 'src/modules/cards/cards.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { VaultModule } from '../vault/vault.module';

import { AuthService } from './application/auth.service';
import { AsyncContextService } from 'src/common/context/async-context.service';
import { ConfirmationCodeService } from './infrastructure/services/confirmation-code.service';
import { SessionService } from './infrastructure/services/session.service';
import { SessionPersistenceService } from './infrastructure/services/session-persistence.service';

import { AuthController } from './infrastructure/controllers/auth.controller';

import { JwtStrategy } from './strategies/jwt.strategy';

import { JwksAdapter } from './infrastructure/adapters/jwks.adapter';
import { JwtTokenAdapter } from './infrastructure/adapters/jwt-token.adapter';
import { ReplayProtectionAdapter } from './infrastructure/adapters/replay-protection.adapter';
import { SessionRepository } from './infrastructure/adapters/session.repository';
import { CardsService } from '../cards/application/cards.service';
import { CardsRepository } from '../cards/infrastructure/adapters';
import { Iso4PinblockService } from '../cards/infrastructure/services/iso4-pinblock.service';
import { TenantsModule } from '../tenants';

import { Session, SessionSchema } from './infrastructure/schemas/session.schema';
import { SessionExpirationScheduler } from './infrastructure/schedulers/session-expiration.scheduler';

/**
 * Módulo de autenticación.
 * - Proporciona generación y validación de JWT con RS256 + JWKS.
 * - Soporta rotación automática de claves.
 * - Implementa anti-replay con validación de jti.
 * - Integra con Vault para custodia de claves privadas.
 * - Integra con UsersModule para validación de credenciales.
 *
 * Exports:
 * - IJwtTokenPort: para generar y validar tokens
 * - IJwksPort: para gestión de claves
 * - IReplayProtectionPort: para validación anti-replay
 */
@Module({
  imports: [
    AuditModule,
    EventEmitter2,
    CachingModule,
    CardsModule,
    PassportModule,
    UsersModule,
    VaultModule,
    PermissionsModule,
    TenantsModule,
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    ScheduleModule.forRoot(),
  ],
  controllers: [AuthController],
  providers: [
    AsyncContextService,
    AuthService,
    // CardsService,
    // CardsRepository,
    // Iso4PinblockService,
    SessionService,
    SessionRepository,
    SessionPersistenceService,
    SessionExpirationScheduler,
    JwtStrategy,
    ConfirmationCodeService,
    {
      provide: 'IJwksPort',
      useClass: JwksAdapter,
    },
    {
      provide: 'IReplayProtectionPort',
      useClass: ReplayProtectionAdapter,
    },
    {
      provide: 'IJwtTokenPort',
      useClass: JwtTokenAdapter,
    },
  ],
  exports: [
    PassportModule,
    AuthService,
    SessionService,
    SessionPersistenceService,
    ConfirmationCodeService,
    'IJwksPort',
    'IReplayProtectionPort',
    'IJwtTokenPort',
  ],
})
export class AuthModule {}
