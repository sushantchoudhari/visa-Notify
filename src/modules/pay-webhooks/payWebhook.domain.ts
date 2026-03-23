import { Prisma, Provider, ProcessingStatus } from '@prisma/client';
import { z } from 'zod';
import { ValidationError } from '../../shared/errors/AppError';

/**
 * Official GOV.UK Pay webhook event types (from API documentation)
 * Reference: https://docs.payments.service.gov.uk/webhooks/
 */
export const PAY_EVENT_TYPES = [
  'card_payment_succeeded',
  'card_payment_captured',
  'card_payment_settled',
  'card_payment_refunded',
] as const;

export type PayEventType = (typeof PAY_EVENT_TYPES)[number];

/**
 * GOV.UK Pay webhook payload structure
 * Reference: https://docs.payments.service.gov.uk/webhooks/#webhook-message-example
 * 
 * The resource object contains the same fields as returned by GET /v1/payments/:paymentId
 */
export interface GovPayWebhookPayload {
  /**
   * Unique identifier for this webhook message
   */
  webhook_message_id: string;

  /**
   * API version (currently 1)
   */
  api_version: number;

  /**
   * ISO 8601 UTC timestamp when the payment event happened
   */
  created_date: string;

  /**
   * Unique payment ID (identical to resource_id)
   */
  resource_id: string;

  /**
   * Type of resource (currently always "payment")
   */
  resource_type: 'payment';

  /**
   * Event type that triggered the webhook
   */
  event_type: PayEventType;

  /**
   * Full payment details (same as GET /v1/payments/:paymentId response)
   */
  resource: {
    amount: number;
    reference: string;
    description: string;
    language: string;
    email?: string;
    payment_id: string;
    payment_provider: string;
    created_date: string;
    state: {
      status: string;
      finished: boolean;
      message?: string;
      code?: string;
    };
    return_url?: string;
    refund_summary?: {
      status: string;
      amount_available: number;
      amount_submitted: number;
    };
    settlement_summary?: Record<string, unknown>;
    card_details?: {
      last_digits_card_number: string;
      first_digits_card_number: string;
      cardholder_name: string;
      expiry_date: string;
      billing_address?: {
        line1: string;
        line2?: string;
        postcode: string;
        city: string;
        country: string;
      };
      card_brand: string;
      card_type: string;
    };
    delayed_capture: boolean;
    moto: boolean;
    provider_id?: string;
  };
}

const govPayWebhookSchema = z.object({
  webhook_message_id: z.string().min(1),
  api_version: z.number().int(),
  created_date: z.string().min(1),
  resource_id: z.string().min(1),
  resource_type: z.literal('payment'),
  event_type: z.string().min(1),
  resource: z.object({
    amount: z.number().int().nonnegative(),
    reference: z.string().min(1),
    description: z.string().min(1),
    language: z.string().min(1),
    payment_id: z.string().min(1),
    payment_provider: z.string().min(1),
    created_date: z.string().min(1),
    state: z.object({
      status: z.string().min(1),
      finished: z.boolean(),
      message: z.string().optional(),
      code: z.string().optional(),
    }),
    return_url: z.string().optional(),
    delayed_capture: z.boolean(),
    moto: z.boolean(),
  }),
});

export const payWebhookDomain = {
  parseAndValidatePayload(rawBody: Buffer): GovPayWebhookPayload {
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new ValidationError('Invalid webhook JSON payload');
    }

    const result = govPayWebhookSchema.safeParse(parsed);
    if (!result.success) {
      throw new ValidationError('Webhook payload validation failed');
    }

    return result.data as GovPayWebhookPayload;
  },

  isValidEventType(eventType: string): eventType is PayEventType {
    return (PAY_EVENT_TYPES as readonly string[]).includes(eventType);
  },

  /**
   * Extract the payment ID from the webhook payload
   */
  getPaymentId(payload: GovPayWebhookPayload): string {
    return payload.resource_id || payload.resource.payment_id;
  },

  /**
   * Build webhook event arguments for DB storage
   */
  buildWebhookEventArgs(
    payload: GovPayWebhookPayload,
    signatureVerified: boolean,
    paymentId?: string,
  ): Prisma.WebhookEventCreateInput {
    return {
      provider: Provider.GOV_PAY,
      externalEventId: `${payload.resource_id}:${payload.event_type}:${payload.created_date}`,
      signatureVerified,
      payloadJson: payload as unknown as Prisma.InputJsonValue,
      processingStatus: ProcessingStatus.PENDING,
      ...(paymentId && { payment: { connect: { id: paymentId } } }),
    };
  },
};
