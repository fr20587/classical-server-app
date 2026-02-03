import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { Tenant } from '../schemas/tenant.schema';
import {
  CreateTenantWebhookDto,
  UpdateTenantWebhookDto,
  mapWebhookToResponse,
} from '../dto/webhook.dto';

/**
 * Servicio para gestionar webhooks de tenants
 */
@Injectable()
export class TenantWebhooksService {
  private readonly logger = new Logger(TenantWebhooksService.name);

  constructor(
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<Tenant>,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Crea un nuevo webhook para un tenant
   */
  async createWebhook(tenantId: string, dto: CreateTenantWebhookDto, requestId: string): Promise<any> {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Agregar a la BD
      tenant.webhooks = tenant.webhooks || [];
      (tenant.webhooks as any[]).push(webhook);

      await tenant.save();

      this.logger.log(`[${requestId}] Webhook creado exitosamente: ${webhook.id}`);

      // Retornar con secret masked
      const maskedSecret = this.cryptoService.maskSecret(webhook.secret);
      return mapWebhookToResponse(webhook, maskedSecret);
    } catch (error) {
      this.logger.error(`[${requestId}] Error creando webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lista webhooks de un tenant
   */
  async listWebhooks(tenantId: string, requestId: string): Promise<any[]> {
    this.logger.log(`[${requestId}] Listando webhooks de tenant ${tenantId}`);

    try {
      const tenant = await this.tenantModel.findOne({ id: tenantId }).exec();
      if (!tenant) {
        throw new NotFoundException('Tenant no encontrado');
      }

      if (!tenant.webhooks || tenant.webhooks.length === 0) {
        return [];
      }

      // Mapear con secrets masked
      return (tenant.webhooks as any[]).map((webhook) => {
        const maskedSecret = this.cryptoService.maskSecret(webhook.secret);
        return mapWebhookToResponse(webhook, maskedSecret);
      });
    } catch (error) {
      this.logger.error(`[${requestId}] Error listando webhooks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene un webhook específico
   */
  async getWebhook(tenantId: string, webhookId: string, requestId: string): Promise<any> {
    this.logger.log(`[${requestId}] Obteniendo webhook ${webhookId}`);

    try {
      const tenant = await this.tenantModel.findOne({ id: tenantId }).exec();
      if (!tenant) {
        throw new NotFoundException('Tenant no encontrado');
      }

      const webhook = (tenant.webhooks as any[])?.find((w) => w.id === webhookId);
      if (!webhook) {
        throw new NotFoundException('Webhook no encontrado');
      }

      const maskedSecret = this.cryptoService.maskSecret(webhook.secret);
      return mapWebhookToResponse(webhook, maskedSecret);
    } catch (error) {
      this.logger.error(`[${requestId}] Error obteniendo webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Actualiza un webhook
   */
  async updateWebhook(
    tenantId: string,
    webhookId: string,
    dto: UpdateTenantWebhookDto,
    requestId: string,
  ): Promise<any> {
    this.logger.log(`[${requestId}] Actualizando webhook ${webhookId}`);

    try {
      const tenant = await this.tenantModel.findOne({ id: tenantId }).exec();
      if (!tenant) {
        throw new NotFoundException('Tenant no encontrado');
      }

      const webhook = (tenant.webhooks as any[])?.find((w) => w.id === webhookId);
      if (!webhook) {
        throw new NotFoundException('Webhook no encontrado');
      }

      // Actualizar campos
      if (dto.url) webhook.url = dto.url;
      if (dto.events) webhook.events = dto.events;
      if (dto.active !== undefined) webhook.active = dto.active;

      // Si se solicita regenerar secret
      if (dto.secret === '__REGENERATE__') {
        webhook.secret = this.cryptoService.generateSecret();
      } else if (dto.secret) {
        webhook.secret = dto.secret;
      }

      webhook.updatedAt = new Date();

      await tenant.save();

      this.logger.log(`[${requestId}] Webhook actualizado exitosamente`);

      const maskedSecret = this.cryptoService.maskSecret(webhook.secret);
      return mapWebhookToResponse(webhook, maskedSecret);
    } catch (error) {
      this.logger.error(`[${requestId}] Error actualizando webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Elimina un webhook
   */
  async deleteWebhook(tenantId: string, webhookId: string, requestId: string): Promise<boolean> {
    this.logger.log(`[${requestId}] Eliminando webhook ${webhookId}`);

    try {
      const tenant = await this.tenantModel.findOne({ id: tenantId }).exec();
      if (!tenant) {
        throw new NotFoundException('Tenant no encontrado');
      }

      const initialLength = (tenant.webhooks as any[])?.length ?? 0;

      // Filtrar y remover webhook
      tenant.webhooks = ((tenant.webhooks as any[]) ?? []).filter((w) => w.id !== webhookId);

      const finalLength = (tenant.webhooks as any[])?.length ?? 0;

      if (finalLength === initialLength) {
        throw new NotFoundException('Webhook no encontrado');
      }

      await tenant.save();

      this.logger.log(`[${requestId}] Webhook eliminado exitosamente`);

      return true;
    } catch (error) {
      this.logger.error(`[${requestId}] Error eliminando webhook: ${error.message}`);
      throw error;
    }
  }
}
