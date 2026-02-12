# Plan: Implementar Colección de Sesiones en MongoDB

**TL;DR**  
Crear una nueva colección `Session` en MongoDB para auditar todas las sesiones de usuarios. Cuando alguien inicia sesión, se guardará userId, datos del usuario, estado (activa/revocada/expirada), y un historial de actualizaciones del access_token. Redis seguirá siendo el caché rápido. Un scheduler ejecutará cada hora para marcar sesiones como expiradas cuando venza el refresh_token.

---

## **Steps**

### 1. **Crear Schema y tipos de dominio para Session**
   - Nuevo archivo: `src/modules/auth/domain/models/session.model.ts`
   - Define enum `SessionStatus` con valores: `ACTIVE`, `REVOKED`, `EXPIRED`
   - Define interfaz `ISessionTokenUpdate` para auditar: `{ timestamp: Date, tokenPreview: string }`
   - Define interfaz `ISession` (contrato de dominio)

### 2. **Crear DTO de Session**
   - Nuevo archivo: `src/modules/auth/dto/session.dto.ts`
   - `CreateSessionDto`: userId, user (UserDTO), loginTimestamp, tokenType, accessTokenExpiresIn
   - `SessionResponseDto`: id, userId, user, status, loginTimestamp, lastActivityTime, tokenUpdates[], createdAt, updatedAt

### 3. **Crear Mongoose Schema para Session**
   - Nuevo archivo: `src/modules/auth/infrastructure/schemas/session.schema.ts`
   - Extiende `AbstractSchema`
   - Campos principales:
     - `userId`: string (ref: User)
     - `user`: UserDTO (objeto embedded para snapshot)
     - `status`: enum ACTIVE | REVOKED | EXPIRED
     - `loginTimestamp`: Date
     - `lastActivityTime`: Date
     - `tokenUpdates`: Array<{ timestamp: Date, tokenPreview: string }> (primeros 5 + "..." + últimos 5 caracteres del token)
     - `expiresAt`: Date (fecha cuando vence refresh_token - 7 días desde login)
     - `ipAddress`: string (opcional future-proofing)
     - `userAgent`: string (opcional future-proofing)

### 4. **Crear repository de Session**
   - Nuevo archivo: `src/modules/auth/infrastructure/adapters/session.repository.ts`
   - Implementar interfaz `ISessionPort` (crear: `src/modules/auth/domain/ports/session.port.ts`)
   - Métodos principales:
     - `create(sessionData)`: Crea nueva sesión
     - `findByUserId(userId)`: Obtiene sesión activa de usuario
     - `updateTokenHistory(userId, newTokenPreview)`: Agrega entrada a `tokenUpdates`
     - `updateStatus(userId, status)`: Cambia estado a REVOKED o EXPIRED
     - `findExpiredSessions()`: Obtiene sesiones donde `expiresAt < now` y status === ACTIVE

### 5. **Crear/actualizar SessionPersistenceService**
   - Nuevo archivo: `src/modules/auth/infrastructure/services/session-persistence.service.ts`
   - Se inyecta `SessionRepository`
   - Métodos orquestadores:
     - `createSession(userId, user, loginTimestamp, tokenType)`: Llama a repository.create()
     - `recordAccessTokenRefresh(userId, newTokenPreview)`: Llama a repository.updateTokenHistory()
     - `revokeSession(userId, reason)`: Actualiza status a REVOKED
     - `expireSessions(userIds: string[])`: Marca múltiples como EXPIRED (para el scheduler)

### 6. **Actualizar AuthService**
   - En `src/modules/auth/application/auth.service.ts`
   - Inyectar `SessionPersistenceService` (nuevo)
   - En método `login()` después de `sessionService.saveSession()` (Redis):
     - Llamar a `sessionPersistenceService.createSession(userId, validation.user, loginTimestamp, 'Bearer')`
   - En método `refreshToken()` después de generar nuevo token:
     - Extraer preview: primeros 5 + "..." + últimos 5 caracteres
     - Llamar a `sessionPersistenceService.recordAccessTokenRefresh(userId, tokenPreview)`
   - Registrar esos eventos en auditoría

### 7. **Crear scheduler para expiración de sesiones**
   - Nuevo archivo: `src/modules/auth/infrastructure/schedulers/session-expiration.scheduler.ts`
   - Usar `@nestjs/schedule` con `@Cron('0 */1 * * * *')` (cada hora)
   - Lógica:
     - Llamar a `sessionPersistenceService.findExpiredSessions()` (o repository.findExpiredSessions)
     - Para cada sesión expirada, actualizar status a EXPIRED vía repository.updateStatus()
     - Logging de cuántas sesiones marcadas como expiradas
     - Auditar el evento en `auditService`

### 8. **Crear módulo/provider SessionPersistence dentro de Auth**
   - Actualizar `src/modules/auth/auth.module.ts`:
     - `MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }])`
     - Providers: `SessionRepository`, `SessionPersistenceService`, `SessionExpirationScheduler`
     - Exports: `SessionPersistenceService` (si otros módulos lo necesitan)

### 9. **Crear migration/índices MongoDB (opcional pero recomendado)**
   - Índice compuesto: `{ userId, status }` (búsquedas rápidas de sesiones activas)
   - Índice simple: `{ expiresAt }` (búsqueda de expiradas)
   - TTL index en `expiresAt` (MongoDB borrará automáticamente después de expirar)

### 10. **Pruebas unitarias**
   - Test `SessionRepository.create()` 
   - Test `SessionRepository.updateTokenHistory()` (valida formato preview)
   - Test `SessionExpirationScheduler` (mock scheduler, verifica que marca expiradas)
   - Test integración en `AuthService.login()` y `AuthService.refreshToken()`

---

## **Verification**

- ✅ Ejecutar test de repository y services: `npm run test -- session`
- ✅ E2E: Hacer login, verificar que documente se crea en MongoDB con estado `ACTIVE`
- ✅ E2E: Hacer refresh token varias veces, verificar que `tokenUpdates` crece con registros de actualizaciones
- ✅ Verificar que scheduler marca sesiones como `EXPIRED` cuando vence la fecha (puede simular con fecha en pasado)
- ✅ Auditoría: Revisar que `auditService` registre creación de sesión y refrescos de token

---

## **Decisions**

- **Redis + MongoDB coexisten**: Redis para caché de acceso rápido (TTL 7 días), MongoDB para auditoría persistent y análisis
- **Token preview**: Primeros 5 + "..." + últimos 5 caracteres para seguridad (no guardar tokens completos)
- **Auditoría historial**: Array `tokenUpdates[]` que registra cada refresh con timestamp
- **Expiración automática**: Scheduler cada 1 hora busca sesiones vencidas y las marca como `EXPIRED` (permite consultar historial después)
- **Datos persistidos**: userId, snapshot de UserDTO, timestamps, y únicamente previsualizaciones de tokens (no los tokens reales)
