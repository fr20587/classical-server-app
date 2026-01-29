import { NavigationItem } from './navigation-item.type';

/**
 * Metadatos sobre la navegación generada
 */
export interface NavigationMetadata {
  /**
   * Total de módulos disponibles en el sistema
   */
  totalModules: number;

  /**
   * Total de módulos accesibles por el usuario autenticado
   */
  accessibleModules: number;

  /**
   * Timestamp de generación de la navegación
   */
  generatedAt: string;

  /**
   * Hash SHA256 (12 chars) para cache busting en frontend
   * Se incluye en header X-Navigation-Version
   */
  versionHash: string;
}

/**
 * Respuesta del endpoint GET /modules/navigation
 */
export interface NavigationResponse {
  /**
   * Array de items de navegación
   */
  navigationItems: NavigationItem[];

}
