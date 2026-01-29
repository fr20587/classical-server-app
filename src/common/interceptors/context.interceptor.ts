import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AsyncContextService } from '../context/async-context.service';

/**
 * ContextInterceptor: Propaga el contexto de AsyncLocalStorage a través de toda la cadena async
 *
 * ⭐ CRÍTICO: Este interceptor ENVUELVE la ejecución del controlador en AsyncLocalStorage.run()
 * Esto garantiza que el requestId esté disponible en TODAS las operaciones async dentro del controlador
 *
 * Sin este interceptor, AsyncLocalStorage.enterWith() solo funciona en el contexto sincrónico
 * y se pierde cuando hay operaciones async (database queries, servicios inyectados, etc.)
 */
@Injectable()
export class ContextInterceptor implements NestInterceptor {
  constructor(private readonly asyncContextService: AsyncContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Obtener el contexto actual que fue establecido por el middleware
    const currentContext = this.asyncContextService.getContext();
    const req = context.switchToHttp().getRequest();
    console.log(`[CONTEXT-INTERCEPTOR] ${req.method} ${req.path}`);

    // Si no hay contexto, simplemente ejecutar el handler normalmente
    if (!currentContext) {
      console.log(`[CONTEXT-INTERCEPTOR] No context found, executing normally`);
      return next.handle();
    }

    // ⭐ ENVOLVER TODA LA CADENA async del controlador en AsyncLocalStorage.run()
    // Esto garantiza que el contexto se propague a través de todas las operaciones async
    return new Observable((subscriber) => {
      console.log(`[CONTEXT-INTERCEPTOR] Running handler with context`);
      this.asyncContextService.run(currentContext, () => {
        // next.handle() devuelve un Observable - subscribirse a él dentro del contexto
        next.handle().subscribe(
          (data) => {
            console.log(`[CONTEXT-INTERCEPTOR] Handler completed successfully`);
            subscriber.next(data);
          },
          (error) => {
            console.log(
              `[CONTEXT-INTERCEPTOR] Handler error: ${error.message}`,
            );
            subscriber.error(error);
          },
          () => {
            console.log(`[CONTEXT-INTERCEPTOR] Handler complete`);
            subscriber.complete();
          },
        );
      });
    });
  }
}
