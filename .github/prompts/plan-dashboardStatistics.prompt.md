# Plan: Endpoint Dashboard de Estadísticas de Transacciones

**Descripción general:**
Crear un nuevo endpoint `/dashboard/statistics` que retorne estadísticas agregadas para un rango de fechas. El sistema calculará métricas de volumen, tendencias, distribución por día/estado, e incluirá datos de clientes, tarjetas y tenants. Tenants verán solo sus datos; admins verán todos. Los períodos se comparan con el período anterior de igual duración para calcular tendencias.

---

## Steps

### 1. Crear DTOs de estadísticas
**Archivo**: `src/modules/transactions/dto/dashboard.dto.ts`

Crear los siguientes DTOs:
- `DashboardStatsQueryDto` (dateFrom, dateTo, tenantId?)
- `TransactionVolumeDto` (total, trend%)
- `TransactionCountDto` (count, trend%)
- `ClientsStatsDto` (activeCount, trend%)
- `TenantsStatsDto` (activeCount, trend%)
- `CardsByTypeDto` (PERSONAL, BUSINESS con count + status breakdown)
- `DailyTrendDto` (dayOfWeek, successfulCount, failedCount, successfulAmount, failedAmount)
- `StatusDistributionDto` (status, percentage)
- `RecentTransactionDto` (id, ref, no, amount, status, customerId, tenantId, createdAt)
- `DashboardStatsResponseDto` (volumeStats, countStats, clientsStats, tenantsStats, cardsStats, dailyTrends[], statusDistribution[], recentTransactions[])

### 2. Extender repositorios con métodos de agregación

#### a. TransactionsRepository
**Archivo**: `src/modules/transactions/infrastructure/adapters/transactions.repository.ts`

Agregar métodos:
- `getTransactionVolumeStats(dateFrom, dateTo, tenantId?)` → {current: sum, previous: sum}
- `getTransactionCountStats(dateFrom, dateTo, tenantId?)` → {current: count, previous: count}
- `getDailyTrendByDayOfWeek(dateFrom, dateTo, tenantId?)` → [{dayOfWeek, successfulCount, failedCount, successfulAmount, failedAmount}]
- `getStatusDistribution(dateFrom, dateTo, tenantId?)` → [{status, count, percentage}]
- `getRecentTransactions(limit=10, tenantId?)` → Transaction[]

#### b. UsersRepository
**Archivo**: `src/modules/users/infrastructure/adapters/users.repository.ts`

Agregar método:
- `getActiveUserStats(dateFrom, dateTo, tenantId?)` → {current: count, previous: count} (solo users con roleKey="user")

#### c. TenantsRepository
**Archivo**: `src/modules/tenants/infrastructure/adapters/tenant.repository.ts`

Agregar método:
- `getActiveTenantStats(dateFrom, dateTo)` → {current: count, previous: count}

#### d. CardsRepository
**Archivo**: `src/modules/cards/infrastructure/adapters/card.repository.ts`

Agregar método:
- `getCardStatsByTypeAndStatus()` → [{cardType, status, count}]

### 3. Crear servicio de estadísticas
**Archivo**: `src/modules/transactions/application/services/dashboard.service.ts`

Crear clase `DashboardService` que:
- Orqueste todas las llamadas a repositorios
- Implemente método `getStatistics(query: DashboardStatsQueryDto): Promise<ApiResponse<DashboardStatsResponseDto>>`
- Valide acceso según rol (admin = todos los datos, tenant = solo sus datos)
- Calcule porcentajes de tendencia: `((current - previous) / previous) * 100`
- Construya respuesta consolidada

### 4. Crear endpoint
**Archivo**: `src/modules/transactions/infrastructure/controllers/transactions.controller.ts`

Agregar:
- `@Get('dashboard/statistics')` (antes de `@Get(':id')` para evitar conflicto de rutas)
- Decoradores: `@Query()`, `@ApiQuery` para parámetros dateFrom, dateTo, tenantId
- Llamar a `DashboardService.getStatistics()`
- Retornar respuesta con status 200

### 5. Validar en módulo
**Archivo**: `src/modules/transactions/transactions.module.ts`

- Agregar `DashboardService` a providers
- Asegurar que `CardsRepository`, `UsersRepository`, `TenantsRepository` estén inyectados en contexto

### 6. Optimización con Swagger
**En el controller** (`transactions.controller.ts`)

- `@ApiOperation` con descripción clara
- `@ApiBearerAuth`, `@ApiSecurity` (hereda de controller)
- `@ApiOkResponse` con tipo `DashboardStatsResponseDto`
- `@ApiForbiddenResponse` (si no es admin ni tenant dueño del tenantId)

---

## Verification

- [ ] Prueba con rango de fechas sin `tenantId` (admin): debe retornar datos globales
- [ ] Prueba con `tenantId` específico (usuarios tenant admin): debe retornar solo sus datos
- [ ] Verifica cálculo de tendencias: si período anterior tenía 100 y actual 120, debe mostrar +20%
- [ ] Valida que transacciones fallidas incluyan CANCELLED y EXPIRED
- [ ] Confirma que últimas 10 transacciones están ordenadas por createdAt DESC
- [ ] Prueba con rango de fechas que no incluya datos: debe retornar 0s, no errores

---

## Decisions

- **Fórmula de tendencia**: `((current - previous) / previous) * 100` (permite negativos para decrementos)
- **Transacciones fallidas**: Estados CANCELLED + EXPIRED
- **Acceso**: Control en aplicación (revisar rol en contexto), no en db query
- **Agregaciones**: Usar operadores MongoDB (`$facet`, `$group`, `$sum`, `$dayOfWeek`) para eficiencia
- **Conteos activos**: Todos los registros activos en fecha rango, no solo nuevos en ese rango
- **Ubicación endpoint**: Bajo `/transactions/dashboard/statistics` para seguir convención del proyecto

---

## Data Structure Reference

### Query Parameters
```
dateFrom: ISO 8601 (e.g., "2026-02-01T00:00:00Z")
dateTo: ISO 8601 (e.g., "2026-02-12T23:59:59Z")
tenantId?: string (optional, filters to specific tenant)
```

### Response Structure
```json
{
  "ok": true,
  "statusCode": 200,
  "data": {
    "volumeStats": {
      "total": 125000,
      "trend": 20.5
    },
    "countStats": {
      "count": 450,
      "trend": 15.3
    },
    "clientsStats": {
      "activeCount": 280,
      "trend": -5.2
    },
    "tenantsStats": {
      "activeCount": 42,
      "trend": 10.0
    },
    "cardsStats": {
      "PERSONAL": {
        "total": 500,
        "byStatus": {
          "ACTIVE": 450,
          "BLOCKED": 30,
          "EXPIRED": 20
        }
      },
      "BUSINESS": {
        "total": 150,
        "byStatus": {
          "ACTIVE": 140,
          "BLOCKED": 10,
          "EXPIRED": 0
        }
      }
    },
    "dailyTrends": [
      {
        "dayOfWeek": "Monday",
        "successfulCount": 45,
        "failedCount": 3,
        "successfulAmount": 18500,
        "failedAmount": 250
      }
    ],
    "statusDistribution": [
      {
        "status": "NEW",
        "percentage": 5.2
      },
      {
        "status": "PROCESSING",
        "percentage": 8.1
      },
      {
        "status": "COMPLETED",
        "percentage": 82.3
      },
      {
        "status": "CANCELLED",
        "percentage": 3.2
      },
      {
        "status": "EXPIRED",
        "percentage": 1.2
      }
    ],
    "recentTransactions": [
      {
        "id": "uuid-1",
        "ref": "REF-001",
        "no": 12345,
        "amount": 50000,
        "status": "COMPLETED",
        "customerId": "user-1",
        "tenantId": "tenant-1",
        "createdAt": "2026-02-12T15:30:00Z"
      }
    ]
  },
  "message": "Estadísticas obtenidas exitosamente",
  "meta": {
    "requestId": "req-uuid",
    "dateRange": {
      "from": "2026-02-01T00:00:00Z",
      "to": "2026-02-12T23:59:59Z"
    }
  }
}
```
