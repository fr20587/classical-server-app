# Plan: Módulo de Dispositivos con ECDH e Intercambio de Claves

**TL;DR**

Crear un módulo `devices` en arquitectura hexagonal que implemente el protocolo de intercambio seguro de claves públicas ECDH P-256 entre dispositivos móviles y servidor. Las claves privadas del servidor se almacenarán en HashiCorp Vault; el módulo gestiona el ciclo de vida de las claves (registro inicial, rotación periódica, revocación) con endpoints protegidos por JWT. El servidor derivará material criptográfico usando HKDF-SHA256 que los dispositivos móviles reutilizarán para operaciones posteriores de PIN. Se mantiene historial de rotación de claves y se integra con auditoría existente.

---

## Estructura de Carpetas

```
src/modules/devices/
├── application/
│   ├── device-key-exchange.service.ts    # Lógica de negocio: intercambio ECDH
│   ├── device-key-rotation.service.ts    # Rotación periódica de claves
│   ├── device-key-revocation.service.ts  # Revocación de claves
│   └── device-key-exchange.service.spec.ts
├── domain/
│   ├── models/
│   │   ├── device-key.model.ts           # Entidad de dominio (key_handle, públicas, etc.)
│   │   ├── device-registration.model.ts  # Registro de dispositivo
│   │   └── key-rotation.model.ts         # Historial de rotación
│   ├── ports/
│   │   ├── device-repository.port.ts     # Puerto: persistencia de dispositivos
│   │   ├── key-rotation.port.ts          # Puerto: historial de rotación
│   │   └── ecdh-crypto.port.ts           # Puerto: operaciones ECDH
│   ├── events/
│   │   ├── device-registered.event.ts
│   │   ├── key-rotated.event.ts
│   │   └── key-revoked.event.ts
│   └── constants/
│       └── device-key.constants.ts       # TTL, longitud de claves, etc.
├── infrastructure/
│   ├── adapters/
│   │   ├── device.repository.ts          # Implementación repositorio MongoDB
│   │   ├── key-rotation.repository.ts    # Implementación historial
│   │   ├── ecdh-crypto.adapter.ts        # Operaciones ECDH (OpenSSL)
│   │   └── vault-key-storage.adapter.ts  # Integración clave privada/Vault
│   ├── controllers/
│   │   ├── device-key-exchange.controller.ts  # POST /devices/key-exchange
│   │   └── device-key-rotation.controller.ts  # POST /devices/rotate-key, DELETE /devices/{id}
│   ├── schemas/
│   │   ├── device-key.schema.ts          # Mongoose schema
│   │   └── key-rotation-history.schema.ts
│   ├── decorators/
│   │   └── device-context.decorator.ts   # Inyectar contexto de dispositivo
│   ├── pipes/
│   │   └── validate-public-key.pipe.ts   # Validación de clave pública ECDH
│   ├── guards/
│   │   └── device-ownership.guard.ts     # Verificar que usuario puede rotar su propia clave
│   └── services/
│       └── device-key-lifecycle.service.ts  # Orquestación: expiración, rotación auto
├── dto/
│   ├── device-key-exchange-request.dto.ts   # Recibir clave pública del dispositivo
│   ├── device-key-exchange-response.dto.ts  # Responder con server_public_key
│   ├── device-key-rotation-request.dto.ts
│   ├── device-info.dto.ts
│   └── key-rotation-history.dto.ts
├── devices.module.ts                    # Configuración del módulo
└── devices-async.module.ts             # (Opcional) Async initialization si necesita setup
```

---

## Steps

### 1. Crear Domain Models (Núcleo de Negocio)

- **[device-key.model.ts](src/modules/devices/domain/models/device-key.model.ts)**: Define estructura inmutable de `IDeviceKey` con campos: `id`, `deviceId`, `userId`, `keyHandle`, `devicePublicKey`, `serverPublicKey`, `saltHex`, `issuedAt`, `expiresAt`, `status` (ACTIVE|ROTATED|REVOKED|EXPIRED)
  
- **[device-registration.model.ts](src/modules/devices/domain/models/device-registration.model.ts)**: `IDeviceRegistration` con metadata de dispositivo: `deviceId`, `userId`, `appVersion`, `platform` (android|ios), `registeredAt`

- **[key-rotation.model.ts](src/modules/devices/domain/models/key-rotation.model.ts)**: `IKeyRotationRecord` para historial: `deviceId`, `previousKeyHandle`, `newKeyHandle`, `rotatedAt`, `reason` (PERIODIC|MANUAL|COMPROMISED), `initiatedBy` (system|userId)

### 2. Crear Domain Ports (Interfaces)

- **[device-repository.port.ts](src/modules/devices/domain/ports/device-repository.port.ts)**: `IDeviceRepository` con métodos: `findByDeviceId(deviceId): Promise<IDeviceKey>`, `findByKeyHandle(keyHandle): Promise<IDeviceKey>`, `create(deviceKey): Promise<IDeviceKey>`, `update(id, partial): Promise<IDeviceKey>`, `delete(id): Promise<void>`, `listRotationHistoryByDeviceId(deviceId, pagination)`

- **[key-rotation.port.ts](src/modules/devices/domain/ports/key-rotation.port.ts)**: `IKeyRotationPort` con métodos: `recordRotation(record): Promise<IKeyRotationRecord>`, `getHistoryByDeviceId(deviceId): Promise<IKeyRotationRecord[]>`

- **[ecdh-crypto.port.ts](src/modules/devices/domain/ports/ecdh-crypto.port.ts)**: `IEcdhCryptoPort` con métodos: `generateKeyPair(): Promise<{privateKeyPem, publicKeyBase64}>`, `deriveSharedSecret(devicePublicKeyB64, serverPrivateKeyPem): Promise<secretBuffer>`, `deriveHkdf(sharedSecret, salt, info): Promise<derivedKeyBytes>`, `validatePublicKey(publicKeyB64): Promise<boolean>`

- **[device-key-exchange.port.ts](src/modules/devices/domain/ports/device-key-exchange.port.ts)**: `IDeviceKeyExchange` (aplicación level) - contrato que describe el flujo completo

### 3. Crear Domain Events

- **[device-registered.event.ts](src/modules/devices/domain/events/device-registered.event.ts)**: Extend `BaseDomainEvent` con payload `{deviceId, userId, keyHandle, registeredAt}`

- **[key-rotated.event.ts](src/modules/devices/domain/events/key-rotated.event.ts)**: Event con `{deviceId, previousKeyHandle, newKeyHandle, reason}`

- **[key-revoked.event.ts](src/modules/devices/domain/events/key-revoked.event.ts)**: Event con `{deviceId, keyHandle, reason}`

### 4. Crear Domain Constants

- **[device-key.constants.ts](src/modules/devices/domain/constants/device-key.constants.ts)**:
  - `ECDH_CURVE = 'prime256v1'` (P-256)
  - `KEY_VALIDITY_DAYS = 365`
  - `SALT_LENGTH_BYTES = 32`
  - `HKDF_INFO = 'ATHPAY_DEVICE_MASTER_KEY_v1'`
  - `KEY_ROTATION_INTERVAL_DAYS = 90` (para rotación periódica)
  - `VAULT_PATH_DEVICE_KEYS = 'secret/devices/keys'`

### 5. Crear Application Services (Lógica de Negocio)

- **[device-key-exchange.service.ts](src/modules/devices/application/device-key-exchange.service.ts)**:
  - Método `exchangePublicKeyWithDevice(userId, request: DeviceKeyExchangeRequestDto): Promise<DeviceKeyExchangeResponseDto>`
  - Valida que el usuario esté autenticado (de contexto JWT)
  - Si `deviceId` ya existe: rota la clave (reemplaza anterior)
  - Genera par de claves del servidor (una vez, luego recupera de Vault)
  - Calcula shared secret `ECDH(serverPrivateKey, devicePublicKey)`
  - Genera salt único de 32 bytes criptográficamente
  - Emite evento `DeviceRegisteredEvent`
  - Retorna `DeviceKeyExchangeResponseDto` con `serverPublicKey`, `keyHandle`, `salt`, `issuedAt`, `expiresAt`
  - Usa transacción para atomicidad

- **[device-key-rotation.service.ts](src/modules/devices/application/device-key-rotation.service.ts)**:
  - Método `rotateDeviceKey(deviceId, userId): Promise<DeviceKeyExchangeResponseDto>` - rotación manual
  - Método `rotateAllExpiredKeys(): Promise<RotationSummary>` - cron periódica (inyectar Scheduler)
  - Valida propiedad (userId = device.userId)
  - Marca clave anterior como ROTATED
  - Registra en historial de rotación
  - Emite evento `KeyRotatedEvent`

- **[device-key-revocation.service.ts](src/modules/devices/application/device-key-revocation.service.ts)**:
  - Método `revokeDeviceKey(deviceId, userId, reason): Promise<void>`
  - Marca clave como REVOKED (no eliminada)
  - Registra en historial
  - Emite evento `KeyRevokedEvent`

### 6. Crear Infrastructure Adapters

- **[device.repository.ts](src/modules/devices/infrastructure/adapters/device.repository.ts)**:
  - Implementa `IDeviceRepository`
  - Usa `@InjectModel(DeviceKey)` para inyección Mongoose
  - CRUD operations con manejo de timestamps
  - Índices: `{deviceId: 1, userId: 1}`, `{keyHandle: 1, status: 1}`
  - Queries optimizadas: `lean()` para lecturas, populate si es necesario

- **[key-rotation.repository.ts](src/modules/devices/infrastructure/adapters/key-rotation.repository.ts)**:
  - Implementa `IKeyRotationPort`
  - Mongoose model para `KeyRotationHistory`
  - Indexado por `{deviceId: 1, rotatedAt: -1}`

- **[ecdh-crypto.adapter.ts](src/modules/devices/infrastructure/adapters/ecdh-crypto.adapter.ts)**:
  - Implementa `IEcdhCryptoPort`
  - Usa librería `crypto` nativa de Node.js (OpenSSL)
  - `generateKeyPair()`: Genera EC KeyPair con curva P-256, exporta como PEM + Base64
  - `deriveSharedSecret()`: ECDH entre privada (server) y pública (device)
  - `deriveHkdf()`: RFC 5869 usando `crypto.hkdfSync()`
  - `validatePublicKey()`: Verifica formato uncompressed (65 bytes), validación criptográfica
  - **Consideración de seguridad**: No loguear nunca claves privadas; loguear solo key_handle
  - Manejo de errores: Result<T, Error> pattern

- **[vault-key-storage.adapter.ts](src/modules/devices/infrastructure/adapters/vault-key-storage.adapter.ts)**:
  - Injector de `INJECTION_TOKENS.VAULT_CLIENT` (ya existe)
  - Método `storeServerPrivateKey(keyHandle, privatePem): Promise<void>` - guarda en `secret/devices/keys/{keyHandle}/private`
  - Método `retrieveServerPrivateKey(keyHandle): Promise<string>` - recupera PEM
  - Manejo de errores Vault
  - Decorador `@Cacheable()` opcional si requerimientos lo permiten

### 7. Crear Infrastructure Schemas (Mongoose)

- **[device-key.schema.ts](src/modules/devices/infrastructure/schemas/device-key.schema.ts)**:
  - `@Schema({ timestamps: true, collection: 'device_keys' })`
  - Campos:
    - `deviceId: string` (UUID del dispositivo)
    - `userId: string` (ObjectId/UUID del usuario)
    - `keyHandle: string` (Identificador opaco único)
    - `devicePublicKey: string` (Base64 ECDH P-256, 65 bytes uncompressed)
    - `serverPublicKey: string` (Base64, para referencia del cliente)
    - `saltHex: string` (Base64, 32 bytes)
    - `status: DeviceKeyStatus` enum (ACTIVE, ROTATED, REVOKED, EXPIRED)
    - `issuedAt: Date`
    - `expiresAt: Date`
    - `platform: string` (android|ios)
    - `appVersion: string`
  - Indexes: `{deviceId: 1, userId: 1}`, `{keyHandle: 1}`, `{expiresAt: 1, status: 1}` (para limpieza)
  - TTL index en `expiresAt` opcional (auto-delete si lo requiere)

- **[key-rotation-history.schema.ts](src/modules/devices/infrastructure/schemas/key-rotation-history.schema.ts)**:
  - `@Schema({ timestamps: true, collection: 'device_key_rotations' })`
  - Campos: `deviceId`, `userId`, `previousKeyHandle`, `newKeyHandle`, `reason` enum, `initiatedBy`, `rotatedAt`
  - Index: `{deviceId: 1, rotatedAt: -1}`

### 8. Crear Infrastructure Controllers

- **[device-key-exchange.controller.ts](src/modules/devices/infrastructure/controllers/device-key-exchange.controller.ts)**:
  - `POST /api/v1/devices/key-exchange` (protegido con `@UseGuards(JwtAuthGuard)`)
  - Endpoint público per se, pero requiere JWT válido del usuario ✓ (respuesta a pregunta Auth)
  - DTO input: `DeviceKeyExchangeRequestDto` con validación `class-validator`
  - Llama a `DeviceKeyExchangeService.exchangePublicKeyWithDevice()`
  - Responde con `DeviceKeyExchangeResponseDto` (DTO de respuesta, sin exponer secretos internos)
  - Decorador `@CurrentActor()` para obtener userId del contexto
  - Logging: registra tentativa de intercambio + key_handle (sin claves)

- **[device-key-rotation.controller.ts](src/modules/devices/infrastructure/controllers/device-key-rotation.controller.ts)**:
  - `POST /api/v1/devices/:deviceId/rotate-key` (protegido con `@UseGuards(JwtAuthGuard, DeviceOwnershipGuard)`)
    - Llama `DeviceKeyRotationService.rotateDeviceKey()`
    - Devuelve `DeviceKeyExchangeResponseDto` con nuevas claves
  - `DELETE /api/v1/devices/:deviceId` (protegido con `JwtAuthGuard`, requiere admin o propietario)
    - Llama `DeviceKeyRevocationService.revokeDeviceKey()`
  - `GET /api/v1/devices/:deviceId/key-history` (protegido)
    - Lista historial de rotación con paginación

### 9. Crear DTOs

- **[device-key-exchange-request.dto.ts](src/modules/devices/dto/device-key-exchange-request.dto.ts)**:
  - `device_public_key: string` - `@IsBase64()`, `@Length(88, 88)` (Base64 de 65 bytes)
  - `device_id: string` - `@IsUUID()`
  - `app_version: string` - `@Matches(/^\d+\.\d+\.\d+$/)`
  - `platform: string` - `@IsIn(['android', 'ios'])`

- **[device-key-exchange-response.dto.ts](src/modules/devices/dto/device-key-exchange-response.dto.ts)**:
  - `server_public_key: string`
  - `key_handle: string`
  - `salt: string`
  - `issued_at: string` (ISO 8601)
  - `expires_at: string` (ISO 8601)

- **[device-key-rotation-request.dto.ts](src/modules/devices/dto/device-key-rotation-request.dto.ts)**:
  - `device_public_key: string` (para nueva clave si lo requiere)
  - `reason: string` (MANUAL|COMPROMISED)

- **[device-info.dto.ts](src/modules/devices/dto/device-info.dto.ts)**:
  - `device_id: string`
  - `platform: string`
  - `app_version: string`
  - `key_handle: string`
  - `status: string`
  - `issued_at: Date`
  - `expires_at: Date`

- **[key-rotation-history.dto.ts](src/modules/devices/dto/key-rotation-history.dto.ts)**:
  - `previous_key_handle: string`
  - `new_key_handle: string`
  - `rotated_at: Date`
  - `reason: string`

### 10. Crear Guards y Pipes

- **[device-ownership.guard.ts](src/modules/devices/infrastructure/guards/device-ownership.guard.ts)**:
  - Implementa `CanActivate`
  - Obtiene userId del `@CurrentActor()`
  - Valida que userId es propietario del dispositivo en la ruta
  - Fail-closed: rechaza si no puede verificar

- **[validate-public-key.pipe.ts](src/modules/devices/infrastructure/pipes/validate-public-key.pipe.ts)**:
  - Pipe customizado que valida formato de clave pública ECDH
  - Aplica en el campo `device_public_key` del DTO
  - Verifica: formato Base64, longitud 88 chars (~65 bytes), estructura válida de punto ECDH

### 11. Crear Module

- **[devices.module.ts](src/modules/devices/devices.module.ts)**:
  - `@Module({ imports, providers, controllers, exports })`
  - Importa: `MongooseModule.forFeature([DeviceKey, KeyRotationHistory])`, `VaultModule` (ya existe), `CommonModule`, `EventEmitterModule`
  - Providers: Services, Repositories, Adapters, Guards, Pipes
  - Controllers: Device key exchange, Device key rotation
  - Exports: Services para uso en otros módulos (si es necesario)
  - Inicialización: Setup de rotación periódica (scheduler)

### 12. Crear Scheduler para Rotación Periódica

- Dentro de `DeviceKeyLifecycleService` o `DeviceKeyRotationService`:
  - `@Cron('0 0 * * 0')` (semanal) o configurar según política
  - Método `handleKeyRotationCron()`: Llama `rotateAllExpiredKeys()` si TTL se aproxima
  - Emite logs/eventos de rotación cerrada

### 13. Integración con Auditoría Existente

- **AuditService** (ya existe): Inyectar en controllers para registrar:
  - `AuditAction.DEVICE_KEY_REGISTERED`
  - `AuditAction.DEVICE_KEY_ROTATED`
  - `AuditAction.DEVICE_KEY_REVOKED`
  - Metadata: `deviceId`, `keyHandle`, `platform`, `userId`
  - No loguear claves privadas ni secretos compartidos

### 14. Integración en app.module.ts

- Importar `DevicesModule` en arrays de imports
- Verificar que orden de imports no causa conflictos circulares (los puertos están aislados)

---

## Verification

### Testing Strategy

1. **Unit Tests** (`*.service.spec.ts`):
   - Validar derivación HKDF con vectors RFC 5869
   - Validar ECDH compartido-secreto (punto en curva válido)
   - Validar lógica de rotación (cambios de estado)
   - Mock: `IDeviceRepository`, `IEcdhCryptoPort`, `VaultClient`

2. **Integration Tests** (`*.repository.spec.ts`):
   - Crear/leer/actualizar dispositivos en MongoDB memory (jest-mongodb)
   - Verificar índices y queries optimizadas
   - Validar transacciones en rotación

3. **E2E Tests** (en `test/devices.e2e-spec.ts`):
   - `POST /devices/key-exchange` → Response con estructura correcta
   - Validar que respuesta incluye `key_handle`, `server_public_key`, `salt`
   - Validar que dispositivo duplicado efectúa rotación (nueva salt)
   - Protección JWT: request sin token → 401
   - Validar que key_handle es único por dispositivo

4. **Manual Testing (Local)**:
   - Llamada con cliente Postman/Insomnia:
     ```http
     POST /api/v1/devices/key-exchange
     Authorization: Bearer <JWT_token>
     Content-Type: application/json
     
     {
       "device_public_key": "BK3mNpQvWx7Zr3ah4K9m...",
       "device_id": "12345678-1234-1234-1234-123456789012",
       "app_version": "1.0.0",
       "platform": "android"
     }
     ```
   - Verificar respuesta: `server_public_key`, `key_handle`, etiqueta `issued_at`/`expires_at`

5. **Security Checklist**:
   - ✓ Clave privada servidor **nunca** en BD (solo en Vault)
   - ✓ Shared secret **nunca** transmitido (solo derivado localmente)
   - ✓ Salt se envía al cliente (público, único por pareja)
   - ✓ JWT requerido para endpoint
   - ✓ Logs no exponen claves
   - ✓ Validación de formato de clave pública (longitud, curva)
   - ✓ Device ownership validado en rotación manual

---

## Decisions

- **Duplicados (device_id)**: Rotar clave — reemplazar anterior, mantener última. Permite que el mismo dispositivo físico se re-registre si la app se reinstala, generando un nuevo key_handle.

- **Almacenamiento clave privada**: HashiCorp Vault — garantiza separación entre código y secretos, cumple PCI-DSS requisito 3.6.3.

- **Rotación de claves**: Periódica (cron semanal/mensual) + manual (usuario lo solicita). Proporciona defensa en profundidad contra compromiso de claves.

- **Autenticación del endpoint**: JWT requerido — consistente con módulo auth existente, previene acceso de dispositivos no identificables. Post-login como especificaste.

- **Patrón Error Handling**: `Result<T, E>` en crimpto, `HttpException` en controllers — allineado con convenciones del proyecto.

- **Clave privada computada vs almacenada**: Computada una vez, almacenada en Vault con key_handle referencia — balance entre seguridad y performance (evitar recomputo en cada transacción).

- **Índices MongoDB**: Incluir `{expiresAt: 1, status: 1}` para queries de limpieza/rotación eficiente.

---

## Next Steps for Implementation

1. Crear domain models y ports (paso 1-4)
2. Implementar adapters criptográficos (paso 6.3)
3. Implementar servicios de aplicación (paso 5)
4. Crear schemas y repositorios (paso 7)
5. Implementar controllers (paso 8)
6. Agregar DTOs (paso 9)
7. Crear guards/pipes (paso 10)
8. Crear módulo principal (paso 11)
9. Implementar scheduler (paso 12)
10. Integrar con auditoría (paso 13)
11. Registrar en app.module (paso 14)
12. Escribir tests completos
13. Validar manualmente contra especificación PCI-DSS
