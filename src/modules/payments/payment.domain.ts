import { PaymentStatus } from '@prisma/client';
import { GovPayStatus } from './payment.types';

/**
 * Domain rules for payments.
 * All business logic lives here — not in controllers or repositories.
 */

const GOV_PAY_TO_INTERNAL: Record<GovPayStatus, PaymentStatus> = {
  created: PaymentStatus.CREATED,
  started: PaymentStatus.IN_PROGRESS,
  submitted: PaymentStatus.IN_PROGRESS,
  capturable: PaymentStatus.IN_PROGRESS,
  success: PaymentStatus.SUCCEEDED,
  failed: PaymentStatus.FAILED,
  cancelled: PaymentStatus.CANCELLED,
  error: PaymentStatus.ERROR,
};

type Transition = `${PaymentStatus}->${PaymentStatus}`;

const VALID_TRANSITIONS = new Set<Transition>([
  'CREATED->IN_PROGRESS',
  'CREATED->FAILED',
  'CREATED->CANCELLED',
  'CREATED->ERROR',
  'IN_PROGRESS->SUCCEEDED',
  'IN_PROGRESS->FAILED',
  'IN_PROGRESS->CANCELLED',
  'IN_PROGRESS->ERROR',
]);

const TERMINAL_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.SUCCEEDED,
  PaymentStatus.FAILED,
  PaymentStatus.CANCELLED,
  PaymentStatus.ERROR,
]);

export const paymentDomain = {
  mapGovPayStatus(govPayStatus: GovPayStatus): PaymentStatus {
    const mapped = GOV_PAY_TO_INTERNAL[govPayStatus];
    if (!mapped) {
      throw new Error(`Unknown GOV.UK Pay status: ${govPayStatus}`);
    }
    return mapped;
  },

  canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
    return VALID_TRANSITIONS.has(`${from}->${to}` as Transition);
  },

  isTerminal(status: PaymentStatus): boolean {
    return TERMINAL_STATUSES.has(status);
  },
};
