import { Prisma, Provider, ProcessingStatus } from '@prisma/client';

export const PAY_EVENT_TYPES = [
  'payment_created',
  'payment_started',
  'payment_succeeded',
  'payment_failed',
  'payment_cancelled',
  'payment_expired',
  'refund_created',
  'refund_succeeded',
  'refund_failed',
] as const;

export type PayEventType = (typeof PAY_EVENT_TYPES)[number];

export interface GovPayWebhookPayload {
  payment_id: string;
  payment_provider: string;
  created_date: string;
  event_date: string;
  event_type: string;
  state: {
    status: string;
    finished: boolean;
    message?: string;
    code?: string;
  };
  resource_id?: string;
  resource_type?: string;
}

export const payWebhookDomain = {
  isValidEventType(eventType: string): eventType is PayEventType {
    return (PAY_EVENT_TYPES as readonly string[]).includes(eventType);
  },

  buildWebhookEventArgs(
    payload: GovPayWebhookPayload,
    signatureVerified: boolean,
    paymentId?: string,
  ): Prisma.WebhookEventCreateInput {
    return {
      provider: Provider.GOV_PAY,
      externalEventId: `${payload.payment_id}:${payload.event_type}:${payload.event_date}`,
      signatureVerified,
      payloadJson: payload as unknown as Prisma.InputJsonValue,
      processingStatus: ProcessingStatus.PENDING,
      ...(paymentId && { payment: { connect: { id: paymentId } } }),
    };
  },
};
