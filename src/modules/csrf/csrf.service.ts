import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { randomUUID } from 'crypto';

@Injectable()
export class CsrfService {
  private readonly CSRF_PREFIX = 'csrf:';
  private readonly CSRF_TTL = 3600; // 1 hora en segundos

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Genera un nuevo token CSRF y lo almacena en cache
   */
  async generateToken(): Promise<string> {
    const token = randomUUID();
    const key = this.CSRF_PREFIX + token;
    
    await this.cacheManager.set(key, true, this.CSRF_TTL * 1000);
    
    return token;
  }

  /**
   * Valida un token CSRF
   */
  async validateToken(token: string): Promise<boolean> {
    if (!token) {
      return false;
    }

    const key = this.CSRF_PREFIX + token;
    const exists = await this.cacheManager.get(key);
    
    return !!exists;
  }

  /**
   * Invalida un token CSRF (útil para rotación)
   */
  async invalidateToken(token: string): Promise<void> {
    if (!token) {
      return;
    }

    const key = this.CSRF_PREFIX + token;
    await this.cacheManager.del(key);
  }

  /**
   * Rota un token CSRF: invalida el viejo y genera uno nuevo
   */
  async rotateToken(oldToken: string): Promise<string> {
    await this.invalidateToken(oldToken);
    return this.generateToken();
  }
}
