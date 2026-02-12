import { setup, createMachine, assign } from 'xstate';
import { UserStatus } from '../enums/enums';

/**
 * Máquina de estados: Ciclo de vida de un usuario
 * Estados: inactive | active | suspended | disabled
 *
 * Flujo:
 * 1. Registro: inactive
 * 2. Verificación de teléfono: inactive → active
 * 3. Incidencia detectada: active → suspended
 * 4. Incidencia resuelta: suspended → active
 * 5. Cierre de cuenta: {inactive | active | suspended} → disabled (definitivo)
 */

export type UserStateType = UserStatus;

export interface UserStateContext {
    id: string;
    reason?: string;
    changedBy?: string;
}

export type UserEvent =
    | { type: 'VERIFY_PHONE' }
    | { type: 'REPORT_INCIDENT'; reason?: string; changedBy?: string }
    | { type: 'RESOLVE_INCIDENT' }
    | { type: 'CLOSE_ACCOUNT'; reason?: string };

export const userStateMachine = createMachine(
    {
        id: 'user-lifecycle',
        initial: UserStatus.INACTIVE,
        context: {
            id: '',
            reason: undefined,
            changedBy: undefined,
        } as UserStateContext,
        states: {
            [UserStatus.INACTIVE]: {
                on: {
                    VERIFY_PHONE: {
                        target: UserStatus.ACTIVE,
                        actions: assign({
                            reason: () => undefined,
                        }),
                    },
                    CLOSE_ACCOUNT: {
                        target: UserStatus.DISABLED,
                        actions: assign({
                            reason: ({ event }) => (event as any).reason,
                        }),
                    },
                },
            },
            [UserStatus.ACTIVE]: {
                on: {
                    REPORT_INCIDENT: {
                        target: UserStatus.SUSPENDED,
                        actions: assign({
                            reason: ({ event }) => (event as any).reason,
                            changedBy: ({ event }) => (event as any).changedBy,
                        }),
                    },
                    CLOSE_ACCOUNT: {
                        target: UserStatus.DISABLED,
                        actions: assign({
                            reason: ({ event }) => (event as any).reason,
                        }),
                    },
                },
            },
            [UserStatus.SUSPENDED]: {
                on: {
                    RESOLVE_INCIDENT: {
                        target: UserStatus.ACTIVE,
                        actions: assign({
                            reason: () => undefined,
                            changedBy: () => undefined,
                        }),
                    },
                    CLOSE_ACCOUNT: {
                        target: UserStatus.DISABLED,
                        actions: assign({
                            reason: ({ event }) => (event as any).reason,
                        }),
                    },
                },
            },
            [UserStatus.DISABLED]: {
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
export function isValidTransition(fromState: UserStateType, toState: UserStateType): boolean {
    const validTransitions: Record<UserStateType, UserStateType[]> = {
        [UserStatus.INACTIVE]: [UserStatus.ACTIVE, UserStatus.DISABLED],
        [UserStatus.ACTIVE]: [UserStatus.SUSPENDED, UserStatus.DISABLED],
        [UserStatus.SUSPENDED]: [UserStatus.ACTIVE, UserStatus.DISABLED],
        [UserStatus.DISABLED]: [],
    };

    return validTransitions[fromState]?.includes(toState) ?? false;
}

/**
 * Helper: Obtiene los eventos disponibles para un estado
 */
export function getAvailableEvents(state: UserStateType): UserEvent['type'][] {
    const availableEvents: Record<UserStateType, UserEvent['type'][]> = {
        [UserStatus.INACTIVE]: ['VERIFY_PHONE', 'CLOSE_ACCOUNT'],
        [UserStatus.ACTIVE]: ['REPORT_INCIDENT', 'CLOSE_ACCOUNT'],
        [UserStatus.SUSPENDED]: ['RESOLVE_INCIDENT', 'CLOSE_ACCOUNT'],
        [UserStatus.DISABLED]: [],
    };

    return availableEvents[state] ?? [];
}
