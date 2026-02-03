# Plan: Módulo de Transacciones con Secuencia Universal, Webhooks y QR Firmado

**TL;DR:** Módulo de transacciones con: (1) secuencia universal en colección `transaction_sequences`, (2) QR como JSON con payload {id, ref, no, tenantName, amount, expiresAt} + firma HMAC-SHA256, (3) TTL configurable en request (máx 24h) con tarea cron para cancelación automática, (4) webhooks por tenant con secret en BD, firma HMAC en headers, sin reintentos, y validación obligatoria de firma en confirmación.

## Steps

### 1. Crear CryptoService en `src/common/crypto/`

- Crear carpeta `src/common/crypto/`
- Archivo `crypto.service.ts`: métodos para generar secrets, crear firmas HMAC-SHA256, validar firmas
- Servicio inyectable: `generateSecret()`, `createSignature(data, secret)`, `verifySignature(data, signature, secret)`
- Exportar desde `src/common/index.ts`

### 2. Crear colección de secuencia universal en `src/modules/transactions/infrastructure/adapters/`

- Documento MongoDB: `{ _id: 'transaction_no', nextNo: number }`
- Interfaz puerto `ISequencePort`: `getNextTransactionNo(): Promise<number>`
- Implementación en MongoDB adapter: atomic `findByIdAndUpdate` con increment
- Garantizar inicialización en seed data (nextNo: 1)

### 3. Extender TenantSchema con webhooks en `src/modules/tenants/infrastructure/schemas/`

- Subdocumento `WebhookConfig`: url, events[], active, secret
- Array `webhooks: WebhookConfig[]` (default: [])
- Índice sparse en `webhooks.url`
- Migración: agregar campo a documentos existentes

### 4. Crear DTOs y endpoints webhook en `src/modules/tenants/infrastructure/controllers/`

- `CreateTenantWebhookDto`: url, events[], secret (opcional: autogenerar)
- `UpdateTenantWebhookDto`: url, events[], active, secret
- `POST /tenants/:tenantId/webhooks` (crear)
- `PUT /tenants/:tenantId/webhooks/:webhookId` (actualizar)
- `DELETE /tenants/:tenantId/webhooks/:webhookId` (eliminar)
- Respuestas ocultan secret completo, mostrar masked version: `secret: "xxxx...last4"`

### 5. Definir entidad Transaction y máquina estados en `src/modules/transactions/domain/`

- Entity: id, ref, no, tenantId, tenantName, customerId, amount, status (new|processing|success|failed|cancelled), cardId, ttlMinutes, expiresAt, signature, createdAt, updatedAt
- Máquina XState: estados {new, processing, success, failed, cancelled}
- Transiciones: {CONFIRM→processing, PROCESS_SUCCESS→success, PROCESS_FAILED→failed, EXPIRE→cancelled, CANCEL→cancelled}
- Eventos: TransactionCreatedEvent, TransactionConfirmedEvent, TransactionProcessedEvent, TransactionExpiredEvent, TransactionCancelledEvent

### 6. Implementar servicios en `src/modules/transactions/application/`

- `TransactionService.create(dto)`: generar id+no, calcular expiresAt, generar signature HMAC, persistir, emitir TransactionCreatedEvent
- `TransactionService.confirm(transactionId, dto{cardId, signature})`: validar firma, transicionar a processing, emitir TransactionConfirmedEvent
- `TransactionService.cancel(transactionId)`: transicionar a cancelled, emitir TransactionCancelledEvent
- `TransactionQueryService`: listar con filtrado por roleKey (user→customerId, merchant→tenantId, otros→params)

### 7. Crear repository en `src/modules/transactions/infrastructure/adapters/`

- `TransactionSchema`: extiende AbstractSchema, campos: ref (unique), no, tenantId, customerId, amount, status, cardId, ttlMinutes, expiresAt, signature, stateSnapshot
- Índices: tenantId, customerId, ref, status, expiresAt, createdAt
- `MongoDbTransactionsRepository`: implementa ITransactionsRepository

### 8. Crear dispatcher de webhooks en `src/modules/transactions/application/`

- `TenantWebhookDispatcher` injectable con constructor(httpService, eventEmitter)
- Listeners: `@OnEvent('transaction.created')`, `@OnEvent('transaction.confirmed')`, etc.
- Método privado `dispatchWebhooks(tenantId, eventType, payload)`:
  - Buscar tenant y obtener webhooks activos
  - Crear firma: `HMAC-SHA256(JSON.stringify(payload), webhookSecret)`
  - POST a URL con headers: `X-Webhook-Signature: {signature}`, `Content-Type: application/json`
  - Fire-and-forget pattern

### 9. Crear tarea cron en `src/modules/transactions/infrastructure/`

- `TransactionExpirationTask` injectable con `@Cron('*/1 * * * *')`
- Buscar: `status=new AND expiresAt <= now`
- Para cada: transicionar a cancelled, emitir TransactionExpiredEvent, auditar
- Patrón fire-and-forget

### 10. Crear controladores en `src/modules/transactions/infrastructure/controllers/`

- `POST /transactions` (cliente): {tenantId, customerId, ref, amount, ttlMinutes≤1440} → retorna {id, ref, no, amount, expiresAt, payload, signature}
- `POST /transactions/:id/confirm` (cliente): {cardId, signature} → valida firma, actualiza, retorna transacción con status processing
- `POST /transactions/:id/cancel` (cliente): cancela transacción
- `GET /transactions` (admin): filtra automático por roleKey + params (status, dateFrom, dateTo)
- `GET /transactions/:id` (admin): detalles completos
- Usar PermissionsGuard con permisos: transactions.create, transactions.read, transactions.confirm, transactions.cancel
- Auditar todas las operaciones

## Decisiones Finales

1. **CryptoService**: Crear servicio centralizado en `src/common/crypto/` para reutilización
2. **Respuesta POST /transactions**: Incluir ambos {payload, signature} en respuesta inicial
3. **Generación de secret webhook**: Siempre autogenerar en creación, permitir regeneración vía endpoint PUT
4. **Validación HTTPS**: Por ahora no validar, solo almacenar URL como string

## Further Considerations

1. **Almacenamiento de secret webhook:** En BD por ahora, más adelante en Vault
2. **Reintentos webhook fallidos:** Sin reintentos por ahora
3. **QR dinámico o estático:** Retornar JSON con payload firmado, cliente genera QR localmente
4. **Validación de callback:** Sí, debe enviar firma obligatoriamente en confirmación
