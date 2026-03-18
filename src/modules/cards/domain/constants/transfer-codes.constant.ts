/**
 * Códigos de respuesta del SGT para operaciones de transferencia
 * Formato: TR + 3 dígitos
 */
export const TRANSFER_CODES = {
  /** Transferencia exitosa (transferencia + consulta de saldo OK) */
  TR000: {
    code: 'TR000',
    message: 'Transferencia exitosa',
    description: 'La transferencia se completó exitosamente',
    isSuccess: true,
  },
  /** Transferencia rechazada por el emisor */
  TR001: {
    code: 'TR001',
    message: 'Transferencia rechazada',
    description: 'La transferencia fue rechazada por el emisor',
    isSuccess: false,
  },
  /** Transferencia OK, consulta de saldo fallida */
  TR002: {
    code: 'TR002',
    message: 'Transferencia exitosa, consulta de saldo fallida',
    description: 'La transferencia se realizó pero no se pudo consultar el saldo',
    isSuccess: true,
  },
  /** Error de comunicación con el emisor */
  TR003: {
    code: 'TR003',
    message: 'Error de comunicación',
    description: 'No se pudo establecer comunicación con el emisor',
    isSuccess: false,
  },
} as const;

export type TransferCode = keyof typeof TRANSFER_CODES;
