import { Payment } from '@prisma/client';
import { PaymentDto, GovPayPaymentResponse, CreateGovPayPaymentRequest } from './payment.types';

export const paymentMapper = {
  toDto(payment: Payment): PaymentDto {
    return {
      id: payment.id,
      applicationId: payment.applicationId,
      govPayPaymentId: payment.govPayPaymentId,
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.reference,
      status: payment.status,
      nextUrl: payment.nextUrl,
      returnUrl: payment.returnUrl,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  },

  toGovPayCreateRequest(
    amount: number,
    reference: string,
    description: string,
    returnUrl: string,
    metadata?: Record<string, string | number | boolean>,
  ): CreateGovPayPaymentRequest {
    return { amount, reference, description, return_url: returnUrl, ...(metadata && { metadata }) };
  },

  extractNextUrl(response: GovPayPaymentResponse): string | null {
    return response._links?.next_url?.href ?? null;
  },
};
