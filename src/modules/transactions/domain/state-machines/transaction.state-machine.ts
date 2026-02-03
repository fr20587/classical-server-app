import { setup, createMachine, assign } from 'xstate';

/**
 * Máquina de estados: Ciclo de vida de una transacción
 * Estados: new → processing → {success | failed | cancelled}
 *
 * Transiciones:
 * - new → processing (cliente confirma con cardId)
 * - new → cancelled (cliente cancela o transacción expira)
 * - processing → success (procesamiento exitoso)
 * - processing → failed (procesamiento falló)
 * - processing → cancelled (cancelación durante procesamiento)
 */

export type TransactionStateType = 'new' | 'processing' | 'success' | 'failed' | 'cancelled';

export interface TransactionStateContext {
  id: string;
  cardId?: string;
  error?: string;
}

export type TransactionEvent =
  | { type: 'CONFIRM'; cardId: string }
  | { type: 'PROCESS_SUCCESS' }
  | { type: 'PROCESS_FAILED'; error: string }
  | { type: 'EXPIRE' }
  | { type: 'CANCEL' };

export const transactionStateMachine = createMachine(
  {
    id: 'transaction-lifecycle',
    initial: 'new',
    context: {
      id: '',
      cardId: undefined,
      error: undefined,
    } as TransactionStateContext,
    states: {
      new: {
        on: {
          CONFIRM: {
            target: 'processing',
            actions: assign({
              cardId: ({ event }) => (event as any).cardId,
            }),
          },
          EXPIRE: {
            target: 'cancelled',
            actions: assign({
              error: () => 'Transacción expirada por timeout',
            }),
          },
          CANCEL: {
            target: 'cancelled',
            actions: assign({
              error: () => 'Cancelada por cliente',
            }),
          },
        },
      },
      processing: {
        on: {
          PROCESS_SUCCESS: {
            target: 'success',
          },
          PROCESS_FAILED: {
            target: 'failed',
            actions: assign({
              error: ({ event }) => (event as any).error,
            }),
          },
          CANCEL: {
            target: 'cancelled',
            actions: assign({
              error: () => 'Cancelada durante procesamiento',
            }),
          },
        },
      },
      success: {
        type: 'final',
      },
      failed: {
        type: 'final',
      },
      cancelled: {
        type: 'final',
      },
    },
  } as const,
  {
    actions: {
      // acciones se definen en el objeto de acciones
    },
  },
);

/**
 * Helper: Valida si una transición es válida según la máquina de estados
 */
export function isValidTransition(fromState: TransactionStateType, toState: TransactionStateType): boolean {
  const validTransitions: Record<TransactionStateType, TransactionStateType[]> = {
    new: ['processing', 'cancelled'],
    processing: ['success', 'failed', 'cancelled'],
    success: [],
    failed: [],
    cancelled: [],
  };

  return validTransitions[fromState]?.includes(toState) ?? false;
}

/**
 * Helper: Obtiene los eventos disponibles para un estado
 */
export function getAvailableEvents(state: TransactionStateType): TransactionEvent['type'][] {
  const availableEvents: Record<TransactionStateType, TransactionEvent['type'][]> = {
    new: ['CONFIRM', 'EXPIRE', 'CANCEL'],
    processing: ['PROCESS_SUCCESS', 'PROCESS_FAILED', 'CANCEL'],
    success: [],
    failed: [],
    cancelled: [],
  };

  return availableEvents[state] ?? [];
}
