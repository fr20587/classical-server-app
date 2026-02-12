import { ISession, ISessionOperationResult, SessionStatus } from '../models/session.model';

/**
 * Puerto (interfaz) para operaciones de persistencia de sesiones en base de datos
 */
export interface ISessionPort {
  /**
   * Crear una nueva sesión en la base de datos
   * @param sessionData Datos iniciales de la sesión
   * @returns Resultado con la sesión creada
   */
  create(sessionData: Partial<ISession>): Promise<ISessionOperationResult<ISession>>;

  /**
   * Buscar sesión activa de un usuario por ID
   * @param userId ID del usuario
   * @returns Resultado con la sesión (si existe)
   */
  findByUserId(userId: string): Promise<ISessionOperationResult<ISession>>;

  /**
   * Agregar un nuevo registro de actualización de access token
   * @param userId ID del usuario
   * @param tokenPreview Preview del nuevo token (primeros 5 + "..." + últimos 5 caracteres)
   * @returns Resultado de la actualización
   */
  updateTokenHistory(userId: string, tokenPreview: string): Promise<ISessionOperationResult<ISession>>;

  /**
   * Cambiar estado de la sesión
   * @param userId ID del usuario
   * @param status Nuevo estado (REVOKED o EXPIRED)
   * @returns Resultado de la actualización
   */
  updateStatus(userId: string, status: SessionStatus): Promise<ISessionOperationResult<ISession>>;

  /**
   * Buscar todas las sesiones activas que han expirado (expiresAt < ahora)
   * @returns Resultado con listado de sesiones expiradas
   */
  findExpiredSessions(): Promise<ISessionOperationResult<ISession[]>>;

  /**
   * Actualizar el timestamp de última actividad
   * @param userId ID del usuario
   * @returns Resultado de la actualización
   */
  updateLastActivity(userId: string): Promise<ISessionOperationResult<ISession>>;
}
