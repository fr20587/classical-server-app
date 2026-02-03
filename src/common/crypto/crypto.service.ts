import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';

/**
 * Servicio centralizado para operaciones criptográficas
 * - Generación de secrets seguros
 * - Creación y validación de firmas HMAC-SHA256
 * - Usado por: webhooks, transacciones, tokens
 */
@Injectable()
export class CryptoService {
  /**
   * Genera un secret seguro de 32 bytes (256 bits) en formato hexadecimal
   * Útil para: webhook secrets, API keys, tokens
   * @returns string de 64 caracteres hex
   */
  generateSecret(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Genera un secret parcialmente visible (masked) para mostrar en respuestas
   * Formato: "xxxx...{últimos 4 caracteres}"
   * @param fullSecret secret completo en formato hex
   * @returns string masked
   */
  maskSecret(fullSecret: string): string {
    if (fullSecret.length < 4) return 'xxxx...';
    return `xxxx...${fullSecret.slice(-4)}`;
  }

  /**
   * Crea una firma HMAC-SHA256 de datos usando un secret
   * @param data datos a firmar (será JSON.stringify si es objeto)
   * @param secret secret en formato hex
   * @returns firma en formato hexadecimal
   */
  createSignature(data: unknown, secret: string): string {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verifica que una firma HMAC-SHA256 sea válida para los datos y secret
   * @param data datos originales
   * @param signature firma a verificar (formato hex)
   * @param secret secret usado para firmar
   * @returns true si la firma es válida, false si no
   */
  verifySignature(data: unknown, signature: string, secret: string): boolean {
    const expectedSignature = this.createSignature(data, secret);
    // Usar comparación constante para evitar timing attacks
    return this.constantTimeCompare(signature, expectedSignature);
  }

  /**
   * Comparación de strings en tiempo constante para prevenir timing attacks
   * @param a primer string
   * @param b segundo string
   * @returns true si son iguales
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
