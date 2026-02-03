/**
 * Puerto: Interfaz para obtener el próximo número de transacción
 * Implementación: MongoDB con colección transaction_sequences
 */
export interface ISequencePort {
  /**
   * Obtiene el próximo número secuencial universal para transacciones
   * Operación atómica garantizada
   * @returns Próximo número de transacción
   */
  getNextTransactionNo(): Promise<number>;
}
