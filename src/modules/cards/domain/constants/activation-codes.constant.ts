/**
 * Códigos de respuesta personalizados para el flujo de activación de PIN
 * El cliente puede usar estos códigos para determinar la acción a seguir
 */
export const ACTIVATION_CODES = {
  /** Flujo completo exitoso: registro + activación + consulta de balance */
  AP000: {
    code: 'AP000',
    message: 'Registro y activación exitosa',
    description: 'El flujo completo se ejecutó correctamente',
  },
  /** Fallo en el registro (paso 1 rechazado por el emisor) */
  AP001: {
    code: 'AP001',
    message: 'Registro rechazado',
    description: 'El emisor rechazó el registro de la tarjeta',
  },
  /** Registro exitoso, activación fallida (paso 2 rechazado). Se devuelve token para reintento */
  AP002: {
    code: 'AP002',
    message: 'Registro exitoso, activación fallida',
    description: 'La tarjeta fue registrada pero la activación del PIN falló. Use el token para reintentar',
  },
  /** Registro y activación exitosos, consulta de balance fallida (paso 3 rechazado). Se devuelve token */
  AP003: {
    code: 'AP003',
    message: 'Activación exitosa, consulta de balance fallida',
    description: 'La tarjeta fue registrada y el PIN activado, pero la consulta de balance falló',
  },
  /** Error de comunicación o timeout con el emisor */
  AP004: {
    code: 'AP004',
    message: 'Error de comunicación',
    description: 'No se pudo establecer comunicación con el emisor',
  },
} as const;

export type ActivationCode = keyof typeof ACTIVATION_CODES;
