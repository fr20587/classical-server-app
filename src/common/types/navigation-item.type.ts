/**
 * Navigation Item Type
 * Representa un item de navegación generado dinámicamente a partir de módulos
 */

/**
 * Item de navegación de la aplicación
 * Puede ser un item básico (módulo individual) o un grupo (categoría con subítems)
 */
export interface NavigationItem {
  /**
   * Identificador único del item
   * Para grupos: nombre de la categoría (ej: 'management', 'keys')
   * Para items básicos: indicador del módulo (ej: 'terminals', 'users')
   */
  id: string;

  /**
   * Título legible del item
   * Para grupos: nombre de la categoría capitalizado
   * Para items básicos: nombre del módulo
   */
  title: string;

  /**
   * Subtítulo opcional del item
   * Descripción breve o tagline del módulo o categoría
   */
  subtitle?: string;

  /**
   * Tipo de item en la navegación
   * - 'basic': Item individual que representa un módulo
   * - 'group': Contenedor de múltiples items bajo una categoría
   */
  type: 'basic' | 'group';

  /**
   * Material Symbol icon name (opcional)
   * Ej: 'devices', 'key', 'security', 'people'
   * Para grupos, puede ser omitido si se muestran los íconos de los hijos
   */
  icon?: string;

  /**
   * URL link para navegación (opcional, no aplicable a grupos)
   * Formato: /modules/{module-indicator}
   * Ej: /modules/terminals, /modules/keys
   */
  link?: string;

  /**
   * Indicador del módulo (solo para items básicos)
   * Ref a Module.indicator
   * Ej: 'terminals', 'keys', 'users'
   */
  indicator?: string;

  /**
   * Orden de presentación del item en la lista
   * Valores numéricos ascendentes para ordenamiento
   */
  order: number;

  /**
   * Subítems del navegación (solo para grupos type='group')
   * Array de items básicos que pertenecen a esta categoría
   * Ordenados por propiedad order
   */
  children?: NavigationItem[];
}
