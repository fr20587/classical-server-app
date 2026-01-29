/**
 * Pagination metadata interface
 */
export interface PaginationMeta {
  /** Current page number */
  page: number;

  /** Number of items per page */
  limit: number;

  /** Total number of items */
  total: number;

  /** Total number of pages */
  totalPages: number;

  /** Next page number, or null if there is no next page */
  nextPage: number | null;

  /** Previous page number, or null if there is no previous page */
  prevPage: number | null;

  /** Indicates if there are more pages */
  hasMore: boolean;
}

/** Sort order type */
export type SortOrder = 'asc' | 'desc';

/**
 * Base de parámetros de consulta con Filtros Genéricos
 */
export interface QueryParams<F = Record<string, any>> {
  /** Page number (default: 1) */
  page?: number;

  /** Number of items per page (default: 10) */
  limit?: number;

  /** Global search query */
  search?: string;

  /** Field to sort by */
  sortBy?: string;

  /** Sort order */
  sortOrder?: SortOrder;

  /** * Agrupador de filtros de negocio.
   * Al ser genérico <F>, puedes definir qué filtros permite cada endpoint.
   */
  filters?: F;
}
