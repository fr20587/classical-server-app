import { PaginationMeta } from '../types/common.types';

/**
 * Crea el objeto de metadatos para la respuesta
 */
export function createPaginationMeta(
  total: number,
  page: number = 1,
  limit: number = 10,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  // Aseguramos que los valores sean números y consistentes
  const currentPage = Number(page);
  const currentLimit = Number(limit);

  return {
    page: currentPage,
    limit: currentLimit,
    total,
    totalPages,
    hasMore: currentPage < totalPages,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    prevPage: currentPage > 1 ? currentPage - 1 : null,
  };
}
