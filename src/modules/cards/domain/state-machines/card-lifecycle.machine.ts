import { createMachine } from 'xstate';
import { CardStatusEnum } from '../enums/card-status.enum';

/**
 * XState machine definition for card lifecycle
 * States: REGISTERED, ACTIVE, BLOCKED
 * Transitions:
 *   REGISTERED → ACTIVE (on ACTIVATE — retry de activación exitoso)
 *   ACTIVE ↔ BLOCKED
 */
export const cardLifecycleMachine = createMachine({
  id: 'cardLifecycle',
  initial: CardStatusEnum.REGISTERED,
  states: {
    [CardStatusEnum.REGISTERED]: {
      on: {
        ACTIVATE: CardStatusEnum.ACTIVE,
      },
    },
    [CardStatusEnum.ACTIVE]: {
      on: {
        BLOCK: CardStatusEnum.BLOCKED,
      },
    },
    [CardStatusEnum.BLOCKED]: {
      on: {
        UNBLOCK: CardStatusEnum.ACTIVE,
      },
    },
  },
});
