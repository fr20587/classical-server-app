import type { UserDTO } from 'src/modules/users/domain/ports/users.port';

/**
 * Estados posibles de una sesión
 */
export enum SessionStatus {
  /** Sesión activa y válida */
  ACTIVE = 'ACTIVE',

  /** Sesión revocada manualmente por el usuario o administrador */
  REVOKED = 'REVOKED',

  /** Sesión expirada porque venció el refresh token */
  EXPIRED = 'EXPIRED',
}

/**
 * Registro de actualización de access token
 * Almacena un preview del token por seguridad (primeros 5 + "..." + últimos 5 caracteres)
 */
export interface ISessionTokenUpdate {
  /** Timestamp cuando se actualizó el access token */
  timestamp: Date;

  /** Preview del access token: primeros 5 + "..." + últimos 5 caracteres */
  tokenPreview: string;
}

/**
 * Contrato de dominio para una sesión de usuario
 */
export interface ISession {
  /** ID único de la sesión (UUID) */
  id: string;

  /** ID del usuario propietario de la sesión */
  userId: string;

  /** Snapshot del usuario al momento del login (para auditoría) */
  user: UserDTO;

  /** Estado actual de la sesión */
  status: SessionStatus;

  /** Timestamp cuando se inició la sesión */
  loginTimestamp: Date;

  /** Último timestamp de actividad en la sesión (acceso a recursos) */
  lastActivityTime: Date;

  /** Historial de actualizaciones de access token */
  tokenUpdates: ISessionTokenUpdate[];

  /** Fecha/hora cuando expira la sesión (7 días desde login) */
  expiresAt: Date;

  /** Dirección IP desde donde se inició la sesión (opcional para future-proofing) */
  ipAddress?: string;

  /** User Agent del navegador/cliente (opcional para future-proofing) */
  userAgent?: string;

  /** Timestamp de creación del documento */
  createdAt: Date;

  /** Timestamp de última actualización del documento */
  updatedAt: Date;
}

/**
 * Respuesta de operación de sesión
 */
export interface ISessionOperationResult<T> {
  /** Si la operación fue exitosa */
  isSuccess: boolean;

  /** Datos retornados (si aplica) */
  data?: T;

  /** Mensaje de error (si aplica) */
  error?: string;
}
