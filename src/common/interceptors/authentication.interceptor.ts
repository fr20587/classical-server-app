import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AsyncContextService } from '../context/async-context.service';
import { Actor } from '../interfaces';

/**
 * AuthenticationInterceptor: Captura el actor autenticado y lo establece en el contexto async
 *
 * ⭐ CRÍTICO: Este interceptor DEBE ejecutarse DESPUÉS de que JwtAuthGuard haya procesado el JWT
 * Extrae el actor de request.user (que fue poblado por JwtStrategy.validate())
 * y lo establece en AsyncContextService para que esté disponible en toda la cadena async
 */
@Injectable()
export class AuthenticationInterceptor implements NestInterceptor {
  constructor(private readonly asyncContextService: AsyncContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const path = req.path;
    const method = req.method;

    // Extraer el actor del request (poblado por JwtStrategy)
    const actor: Actor | undefined = req.user;

    if (actor) {
      console.log(`[AUTH-INTERCEPTOR] ${method} ${path} - Actor found:`, actor);
      // Establecer el actor en el contexto async
      this.asyncContextService.setActor(actor);
      console.log(`[AUTH-INTERCEPTOR] Actor set in async context`);
    } else {
      console.log(`[AUTH-INTERCEPTOR] ${method} ${path} - No actor in request`);
    }

    return next.handle();
  }
}
