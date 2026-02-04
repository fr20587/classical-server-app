import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';
import { CryptoService } from 'src/common/crypto/crypto.service';
import { v4 as uuidv4 } from 'uuid';
import { Tenant } from '../../infrastructure/schemas/tenant.schema';
import { CreateTenantWebhookDto, mapWebhookToResponse } from '../../dto/webhook.dto';
import { AsyncContextService } from 'src/common/context';
import { AuditService } from 'src/modules/audit/application/audit.service';


/**
 * Servicio para gestionar webhooks de tenants
 */
@Injectable()
export class TenantWebhooksService {
  private readonly logger = new Logger(TenantWebhooksService.name);

  constructor(
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<Tenant>,
    private readonly asyncContextService: AsyncContextService,
    private readonly auditService: AuditService,
    private readonly cryptoService: CryptoService,
  ) { }

  /**
   * Crea un nuevo webhook para el tenant del usuario autenticado
   * Obtiene el tenantId del contexto del usuario y agrega el webhook al tenant existente
   */
  async createWebhook(dto: CreateTenantWebhookDto): Promise<any> {
    const requestId = this.asyncContextService.getRequestId();
    const userId = this.asyncContextService.getActorId();
    const actor = this.asyncContextService.getActor();

    // Obtener tenantId del contexto del actor
    const tenantId = actor?.tenantId;

    if (!tenantId) {
      this.logger.error(`[${requestId}] No tenantId found in actor context`);
      throw new NotFoundException('No se encontró tenant asociado al usuario');
    }

    this.logger.log(`[${requestId}] Creando webhook para tenant ${tenantId}`);

    try {
      const tenant = await this.tenantModel.findOne({ id: tenantId }).exec();
      if (!tenant) {
        throw new NotFoundException('Tenant no encontrado');
      }

      // Generar secret si no se proporciona
      const secret = dto.secret ?? this.cryptoService.generateSecret();

      // Crear objeto webhook
      const webhook = {
        id: uuidv4(),
        url: dto.url,
        events: dto.events,
        active: true,
        secret,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Agregar a la BD
      tenant.webhooks = tenant.webhooks || [];
      (tenant.webhooks as any[]).push(webhook);

      await tenant.save();

      this.logger.log(`[${requestId}] Webhook creado exitosamente: ${webhook.id}`);

      // Registrar en auditoría
      this.auditService.logAllow('WEBHOOK_CREATED', 'tenant-webhook', webhook.id, {
        module: 'tenants',
        severity: 'MEDIUM',
        tags: ['webhook', 'create', 'successful', `tenantId:${tenantId}`],
        actorId: userId,
        changes: {
          after: {
            webhookId: webhook.id,
            events: dto.events,
            url: dto.url,
          },
        },
      });

      // Retornar con secret masked
      const maskedSecret = this.cryptoService.maskSecret(webhook.secret);
      return mapWebhookToResponse(webhook, maskedSecret);
    } catch (error) {
      this.logger.error(`[${requestId}] Error creando webhook: ${error.message}`);
      
      // Registrar error en auditoría
      this.auditService.logError(
        'WEBHOOK_CREATED',
        'tenant-webhook',
        'unknown',
        error instanceof Error ? error : new Error(String(error)),
        {
          module: 'tenants',
          severity: 'HIGH',
          tags: ['webhook', 'create', 'error', `tenantId:${tenantId}`],
          actorId: userId,
        },
      );
      
      throw error;
    }
  }
}
