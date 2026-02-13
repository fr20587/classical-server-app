# Plan: Implementar MFA con TOTP y Speakeasy

**TL;DR**: Implementar autenticación de dos factores con TOTP como característica opcional. Se guardará la semilla encriptada en Vault bajo `users/{userId}/totp/{userId}`, se crearán backup codes para recuperación, y se integrarán 4 nuevos endpoints. El flujo de login validará TOTP si el usuario lo tiene activado. Seguiremos el patrón Hexagonal con Ports & Adapters.

---

## Decisiones de Arquitectura

- **Activación TOTP**: Opcional (usuario decide si habilitar)
- **Backup codes**: Sí, implementar codes de recuperación
- **Almacenamiento Vault**: `users/{userId}/totp` con versión y encriptación
- **Verificación para reconfigurar**: Requiere validación SMS (código actual)
- **Semilla encriptada en Vault**: Almacenamiento seguro siguiendo patrón existente (como PAN)
- **Backup codes hasheados**: No guardamos plain text, solo hash en MongoDB
- **JWT con claims**: `totp_required: true` y `totp_verified: true` para orquestar flujo de login
- **Speakeasy config**: Ventana de tiempo 30s (TOTP estándar), tolerancia ±1 paso
- **Arquitectura Puerto-Adaptador**: Mantiene patrón hexagonal consistente con codebase

---

## Fase 1: Infraestructura de Dominio (Ports & Models)

### 1.1 Crear Puerto TOTP
**Archivo**: `src/modules/auth/domain/ports/totp.port.ts`

```typescript
export interface ITotpPort {
  generateSecret(userId: string): Promise<{secret: string, qrCode: string}>;
  verifyToken(token: string, secret: string): Promise<boolean>;
  generateBackupCodes(count: number): Promise<string[]>;
}
```

Métodos:
- `generateSecret(userId)` → `{secret, qrCode}`
- `verifyToken(token, secret)` → `boolean`
- `generateBackupCodes(count)` → `string[]`

### 1.2 Crear Enums
**Archivo**: `src/modules/auth/domain/enums/totp-status.enum.ts`

```typescript
export enum TotpStatus {
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}
```

### 1.3 Crear Models
**Archivo**: `src/modules/auth/domain/models/totp.model.ts`

```typescript
export interface TotpConfig {
  secret?: string; // Referencia en Vault
  status: TotpStatus;
  vaultSecretPath?: string;
  activatedAt?: Date;
  backupCodesUsed?: string[]; // Hashes de códigos utilizados
}
```

### 1.4 Extender User Schema
**Archivo**: `src/modules/users/infrastructure/schemas/user.schema.ts`

Agregar propiedades:
```typescript
totp?: {
  status: TotpStatus;
  vaultSecretPath?: string;
  activatedAt?: Date;
};
totpBackupCodesUsed?: string[]; // Array de hashes
```

---

## Fase 2: Adaptadores (Puertos Implementados)

### 2.1 Crear Adaptador TOTP
**Archivo**: `src/modules/auth/infrastructure/adapters/totp.adapter.ts`

Implementa `ITotpPort`:
- Inyectar `VaultHttpAdapter` para persistencia
- Inyectar `CryptoService` para hashing de backup codes
- `generateSecret()`: 
  - Usa speakeasy para generar secreto (base32)
  - Genera QR code usando qrcode library
  - Retorna `{secret, qrCode}`
- `verifyToken()`: 
  - speakeasy.verifyToken() con ventana de tolerancia (±1 paso)
  - Retorna boolean
- `generateBackupCodes()`:
  - Genera 10 códigos de recuperación (formato: XXXX-XXXX-XXXX)
  - Hashea cada uno con Argon2
  - Retorna array de códigos plain (solo para mostrar al usuario una vez)

Almacenamiento:
- Guardar secreto encriptado en Vault bajo `users/{userId}/totp/{userId}`
- Path Vault debe ser accesible y versionado

### 2.2 Crear Servicio TOTP
**Archivo**: `src/modules/auth/infrastructure/services/totp.service.ts`

Métodos de lógica de orquestación:
- `setupTotp(userId, userPhone)`: 
  - Genera secreto via adapter
  - Valida que no exista uno activo
  - Retorna QR code para escanear
  
- `verifyAndActivateTotp(userId, totpToken, backupCodes)`:
  - Valida que el token TOTP sea correcto
  - Activa estado TOTP en usuario
  - Almacena hashes de backup codes
  
- `verifyTotpToken(userId, token)`:
  - Recupera semilla desde Vault
  - Valida token contra semilla via adapter
  
- `disableTotp(userId)`:
  - Marca como DISABLED
  - Limpia backup codes usado
  
- `useBackupCode(userId, code)`:
  - Hashea código ingresado
  - Busca en array de codes usados
  - Si no está usado, marca como usado
  - Retorna boolean

Inyecciones:
- `TotpAdapter` (ITotpPort)
- `VaultHttpAdapter` (IVaultClient)
- `UsersService` (para actualizar usuario)
- `CryptoService` (para hashing)

---

## Fase 3: Integración en Auth Service

### 3.1 Extender AuthService
**Archivo**: `src/modules/auth/application/auth.service.ts`

Modificaciones en método `login()`:
1. Validar credenciales (existente)
2. Verificar si `user.totp.status === TotpStatus.ACTIVE`
3. Si TOTP activo:
   - Generar JWT con claims: `{sub, totp_required: true, totp_verified: false}`
   - NO incluir roles ni permisos en este JWT
   - TTL corto: 5 minutos
   - Retornar `{verification_token: jwt, requires_totp: true}`
4. Si TOTP no activo:
   - Retornar `access_token` normal (flujo actual)

Nuevo método `verifyTotpLogin()`:
```typescript
async verifyTotpLogin(
  userId: string,
  totpToken: string,
  verificationToken: string,
  ipAddress?: string
): Promise<LoginResponseDto>
```

- Valida `verification_token` (JWT corto)
- Valida token TOTP via `TotpService.verifyTotpToken()`
- Si ambos válidos:
  - Genera `access_token` completo (roles, permisos, etc.)
  - Retorna `{access_token, token_type, expires_in, ...}`
- Emite evento `TotpVerificationSuccessEvent` para auditoría

Nuevo método `verifyTotpLoginWithBackupCode()`:
- Similar a `verifyTotpLogin()` pero usa `TotpService.useBackupCode()`

---

## Fase 4: DTOs y Controlador

### 4.1 Crear DTOs
**Archivo**: `src/modules/auth/dto/totp.dto.ts`

```typescript
// Setup - Genera nuevo secreto
export class SetupTotpRequestDto {}

export class SetupTotpResponseDto {
  secret: string;          // Base32 encoded
  qrCode: string;          // Data URL para QR
  backupCodes: string[];   // [XXXX-XXXX-XXXX, ...]
  message: string;         // "Instrucciones: escanea QR..."
}

// Activate - Verifica código TOTP para activar
export class ActivateTotpRequestDto {
  totpToken: string;       // Código de 6 dígitos
}

export class ActivateTotpResponseDto {
  success: boolean;
  message: string;
  backupCodes?: string[];  // Retornar solo si es primera activación
}

// Login con TOTP
export class VerifyTotpLoginRequestDto {
  verificationToken: string;  // JWT del login anterior
  totpToken: string;          // Código de 6 dígitos
  rememberDevice?: boolean;   // Opcional: para "Recordar este dispositivo"
}

// Usar backup code
export class UseBackupCodeRequestDto {
  verificationToken: string;
  backupCode: string;         // XXXX-XXXX-XXXX
}

// Disable TOTP
export class DisableTotpRequestDto {
  password?: string;          // Confirmación opcional
}

export class DisableTotpResponseDto {
  success: boolean;
  message: string;
}
```

### 4.2 Extender AuthController
**Archivo**: `src/modules/auth/infrastructure/controllers/auth.controller.ts`

Nuevos endpoints:

```typescript
@Post('totp/setup')
@UseGuards(JwtAuthGuard)
async setupTotp(
  @Request() req,
): Promise<ApiResponse<SetupTotpResponseDto>> {
  // Validar que usuario exist y tenga phone confirmado
  // Llamar TotpService.setupTotp()
  // Retornar QR + backup codes
}

@Post('totp/activate')
@UseGuards(JwtAuthGuard)
async activateTotp(
  @Request() req,
  @Body() dto: ActivateTotpRequestDto,
): Promise<ApiResponse<ActivateTotpResponseDto>> {
  // Validar token TOTP
  // Activar TOTP en usuario
  // Guardar backup codes
  // Emitir evento
}

@Post('totp/verify-login')
async verifyTotpLogin(
  @Body() dto: VerifyTotpLoginRequestDto,
  @IpAddress() ipAddress: string,
): Promise<ApiResponse<LoginResponseDto>> {
  // Sin guardia - el verification_token es el JWT
  // Validar verification_token
  // Validar TOTP token
  // Retornar access_token completo
  // Rate limit: 3 intentos en 15 min
}

@Post('totp/use-backup')
async useBackupCode(
  @Body() dto: UseBackupCodeRequestDto,
  @IpAddress() ipAddress: string,
): Promise<ApiResponse<LoginResponseDto>> {
  // Similar a verify-totp-login
  // Pero valida backup code
  // Marca como usado
}

@Post('totp/disable')
@UseGuards(JwtAuthGuard)
async disableTotp(
  @Request() req,
  @Body() dto: DisableTotpRequestDto,
): Promise<ApiResponse<DisableTotpResponseDto>> {
  // Requiere JWT válido
  // Desactiva TOTP
  // Limpia backup codes
}
```

---

## Fase 5: Eventos y Auditoría

### 5.1 Crear Domain Events
**Archivo**: `src/modules/auth/events/`

Eventos a crear:
- `TotpSetupInitiatedEvent` - Cuando usuario inicia setup
- `TotpActivatedEvent` - Cuando usuario verifica y activa
- `TotpDisabledEvent` - Cuando usuario desactiva
- `TotpVerificationAttemptedEvent` - Cada intento de verificación
- `TotpVerificationFailedEvent` - Cuando falla validación (para anti-brute force)
- `BackupCodeUsedEvent` - Cuando se usa un backup code

Cada evento debe incluir:
- userId
- timestamp
- ipAddress (si aplica)

### 5.2 Emitir Eventos
- Desde `TotpService` métodos correspondientes
- Capturados por listeners en módulo de auditoría
- Loguear en schema de auditoría

---

## Fase 6: Validación y Seguridad

### 6.1 Crear Guard para TOTP (Opcional)
**Archivo**: `src/modules/auth/guards/totp-verified.guard.ts` (si necesita endpoints específicos protegidos por TOTP)

```typescript
@Injectable()
export class TotpVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    return user.totp_verified === true;
  }
}
```

### 6.2 Rate Limiting
- En `verifyTotpLogin()`: máximo 3 intentos fallidos en 15 minutos
- Usar `CachingService` existente con key `totp_attempts:{userId}`
- Lanzar `TooManyRequestsException` si se excede

### 6.3 Validación de Inputs
- TOTP token: debe ser 6 dígitos numéricos
- Backup code: formato XXXX-XXXX-XXXX (12 caracteres alphanumericos + guiones)
- Usar `class-validator` en DTOs

---

## Fase 7: Documentación y Testing

### 7.1 Tests Unitarios
**Archivo**: `src/modules/auth/infrastructure/adapters/totp.adapter.spec.ts`

Casos:
- generateSecret() genera secreto válido y QR
- verifyToken() valida token correcto
- verifyToken() rechaza token inválido
- generateBackupCodes() genera array de 10 códigos
- Tolerancia de ±1 step en verifyToken()

**Archivo**: `src/modules/auth/infrastructure/services/totp.service.spec.ts`

Casos:
- setupTotp() genera secreto y lo guarda en Vault
- verifyAndActivateTotp() activa TOTP en usuario
- verifyTotpToken() recupera desde Vault y valida
- disableTotp() limpia propiedades
- useBackupCode() marca como usado

### 7.2 Integration Tests
**Archivo**: `src/modules/auth/application/auth.service.integration.spec.ts`

Casos:
- Login normal sin TOTP (flujo existente)
- Login con TOTP activo retorna verification_token
- verifyTotpLogin() con token válido retorna access_token
- verifyTotpLogin() con token inválido falla
- useBackupCode() completa login sin TOTP token
- Backup code no puede usarse dos veces

### 7.3 E2E Tests
**Archivo**: `test/totp.e2e-spec.ts`

Flujo completo:
1. Register usuario normal
2. POST `/auth/totp/setup` → obtener QR
3. Escanear QR con autenticador (simular)
4. POST `/auth/totp/activate` con código correcto → confirma
5. POST `/auth/login` → obtiene verification_token
6. POST `/auth/totp/verify-login` con TOTP token → obtiene access_token
7. Usar access_token en endpoint protegido → funciona
8. POST `/auth/totp/disable` → desactiva
9. POST `/auth/login` posterior ya no requiere TOTP

Casos edge:
- TOTP inválido en activate
- Backup code inválido
- Rate limiting en verify-login
- Expiración de verification_token

---

## Flujos de Negocio

### Flujo Setup Inicial
```
1. User autenticado POST /auth/totp/setup
2. Servicio genera secreto, lo guarda en Vault como PENDING
3. Retorna QR + backup codes al cliente
4. User escanea QR en Authenticator o copia secreto manual
5. User envía código con POST /auth/totp/activate
6. Servicio valida código, marca como ACTIVE
7. User guarda backup codes en lugar seguro
```

### Flujo Login con TOTP Activo
```
1. User POST /auth/login (phone + password + x-api-key)
2. Server valida credenciales
3. Server detecta user.totp.status === ACTIVE
4. Server retorna {verification_token, requires_totp: true}
5. Client muestra prompt "Ingresa código de autenticador"
6. User ingresa código TOTP
7. Client POST /auth/totp/verify-login (verification_token + totp_token)
8. Server valida verification_token JWT
9. Server valida TOTP con semilla en Vault
10. Si válido, retorna {access_token, token_type, expires_in}
11. Si inválido, retorna error (rate limited si muchos intentos)
```

### Flujo Backup Code
```
1. Login devuelve verification_token (paso anterior hasta paso 4)
2. User ha perdido acceso a autenticador
3. Client POST /auth/totp/use-backup (verification_token + backup_code)
4. Server valida backup coin en lista sin usar
5. Si válido, marca como usado, retorna access_token
6. Si inválido, error y rate limit

Nota: Cada user tiene ~10 backup codes, solo se pueden usar una vez cada uno
```

### Flujo Disable TOTP
```
1. User autenticado POST /auth/totp/disable
2. Servicio valida que TOTP esté ACTIVE
3. Marca como DISABLED
4. Limpia backup codes usados
5. Próximo login no requiere TOTP
```

---

## Dependencias Externas Requeridas

### Ya Instaladas (según output):
- speakeasy (0.1.0 o similar)
- qrcode (para generar QR data URLs)

### Verificar:
```bash
npm list speakeasy
npm list qrcode
```

Si falta qrcode:
```bash
npm install qrcode
```

---

## Validación Post-Implementación

### Testing Manual
1. Ejecutar tests: `npm test src/modules/auth`
2. Flujo E2E:
   - Crear usuario
   - Setup TOTP → escanear QR
   - Activate → confirmar código
   - Login → usar TOTP
   - Validate access_token funciona
3. Verify en Vault:
   - `vault kv list users/`
   - `vault kv get users/{userId}/totp/{userId}`
   - Confirmar que secret está encriptado

### Checks de Seguridad
- [ ] Secrets no están loguedos en console
- [ ] Verification_token expira en 5 min max
- [ ] Rate limiting funciona en verify-login
- [ ] Backup codes están hasheados, no plain text
- [ ] Eventos de auditoría se registran
- [ ] QR codes se generan correctamente
- [ ] TOTP ±1 step correctamente implementado

---

## Orden de Implementación Recomendado

1. **Primero**: Fase 1 (Ports, Enums, Models, Schema)
2. **Segundo**: Fase 2 (Adapters y Services)
3. **Tercero**: Fase 3 (AuthService integration)
4. **Cuarto**: Fase 4 (DTOs, Controller endpoints)
5. **Quinto**: Fase 5 (Events)
6. **Sexto**: Fase 6 (Guards, Rate limiting)
7. **Séptimo**: Fase 7 (Tests)

---

## Notas Importantes

- **Vault Paths Consistency**: Mantener patrón `users/{userId}/totp/{userId}` alineado con estructura existente
- **Backward Compatibility**: Usuarios sin TOTP funciona normal (estado NOT_CONFIGURED)
- **QR Code Format**: Usar estándar otpauth:// URI: `otpauth://totp/App:user@email?secret=XXX&issuer=App`
- **Speakeasy Config**: 
  - Time step: 30 segundos
  - Digest algorithm: SHA1 (estándar)
  - Digits: 6 (estándar)
  - Window: ±1 steps
