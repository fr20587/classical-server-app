/**
 * Pipe: ValidatePublicKeyPipe
 * 
 * Valida que una clave pública ECDH tenga el formato correcto.
 */

import {
    PipeTransform,
    Injectable,
    BadRequestException,
    Logger,
    Inject,
} from '@nestjs/common';
import type { IEcdhCryptoPort } from '../../domain/ports/ecdh-crypto.port';
import { DEVICE_INJECTION_TOKENS } from '../../domain/constants/device-injection-tokens';

@Injectable()
export class ValidatePublicKeyPipe implements PipeTransform {
    private readonly logger = new Logger(ValidatePublicKeyPipe.name);

    constructor(
        @Inject(DEVICE_INJECTION_TOKENS.ECDH_CRYPTO_PORT)
        private readonly ecdhCrypto: IEcdhCryptoPort,
    ) { }

    async transform(value: string): Promise<string> {
        if (!value) {
            throw new BadRequestException('Public key is required');
        }

        // Validar que sea Base64
        try {
            Buffer.from(value, 'base64');
        } catch (error) {
            throw new BadRequestException('Invalid Base64 format for public key');
        }

        // Validar formato ECDH
        const validation = await this.ecdhCrypto.validatePublicKey(value);

        if (!validation.isValid) {
            this.logger.warn(`Invalid public key: ${validation.reason}`);
            throw new BadRequestException(`Invalid ECDH P-256 public key: ${validation.reason}`);
        }

        return value;
    }
}
