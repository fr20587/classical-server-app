/**
 * Guard: DeviceOwnershipGuard
 * 
 * Valida que el usuario autenticado es propietario del dispositivo.
 */

import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    NotFoundException,
    Inject,
} from '@nestjs/common';
import type { IDeviceRepository } from '../../domain/ports/device-repository.port';
import { DEVICE_INJECTION_TOKENS } from '../../domain/constants/device-injection-tokens';

@Injectable()
export class DeviceOwnershipGuard implements CanActivate {
    constructor(
        @Inject(DEVICE_INJECTION_TOKENS.DEVICE_REPOSITORY)
        private readonly deviceRepository: IDeviceRepository,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        // Obtener userId del token JWT (poblado por JwtAuthGuard)
        const userId = request.user?.id;
        if (!userId) {
            throw new ForbiddenException('User not authenticated');
        }

        // Obtener deviceId de los parámetros de ruta
        const deviceId = request.params.deviceId;
        if (!deviceId) {
            throw new ForbiddenException('Device ID is required');
        }

        // Verificar que el dispositivo existe y es propiedad del usuario
        const device = await this.deviceRepository.findByDeviceId(deviceId);

        if (!device || device.userId !== userId) {
            throw new ForbiddenException(
                'You do not have permission to access this device',
            );
        }

        // Adjuntar dispositivo al request para uso en controllers
        request.device = device;

        return true;
    }
}
