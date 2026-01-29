import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';

/**
 * ⭐ SharedContextModule: Módulo compartido para contexto async con nestjs-cls
 * 
 * Importa ClsModule y lo exporta para que esté disponible en toda la aplicación
 * Debe ser importado en AppModule como primer módulo para asegurar que ClsService
 * esté disponible antes que otros módulos que lo dependan
 */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      middleware: {
        // Automount ClsMiddleware para todas las rutas
        mount: true,
        // Setup: Establecer valores por defecto basados en la request
        setup: (cls, req) => {
          // El requestId será establecido por RequestIdMiddleware
          // pero ClsModule también puede generar uno si lo necesita
          // cls.set('requestId', cls.getId());
        },
      },
    }),
  ],
  exports: [ClsModule],
})
export class SharedContextModule {}
