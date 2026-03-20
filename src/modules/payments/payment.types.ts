/**
 * GOV.UK Pay API status values returned by the Pay API.
 * Reference: https://docs.payments.service.gov.uk/api_reference/#payment-status-lifecycle
 */
export type GovPayStatus =
  | 'created'
  | 'started'
  | 'submitted'
  | 'capturable'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'error';

export interface GovPayPaymentState {
  status: GovPayStatus;
  finished: boolean;
  message?: string;
  code?: string;
}

export interface GovPayPaymentLink {
  href: string;
  method: string;
}

export interface GovPayPaymentLinks {
  next_url?: GovPayPaymentLink;
  next_url_post?: GovPayPaymentLink;
  self?: GovPayPaymentLink;
  events?: GovPayPaymentLink;
  refunds?: GovPayPaymentLink;
  cancel?: GovPayPaymentLink;
  capture?: GovPayPaymentLink;
}

export interface GovPayPaymentResponse {
  payment_id: string;
  amount: number;
  reference: string;
  description: string;
  state: GovPayPaymentState;
  return_url: string;
  payment_provider: string;
  created_date: string;
  _links: GovPayPaymentLinks;
}

export interface CreateGovPayPaymentRequest {
  amount: number;
  reference: string;
  description: string;
  return_url: string;
  language?: 'en' | 'cy';
  metadata?: Record<string, string | number | boolean>;
}

export interface CreatePaymentRequest {
  applicationId: string;
  amount: number;
  reference: string;
  description: string;
  returnUrl: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface PaymentDto {
  id: string;
  applicationId: string;
  govPayPaymentId: string | null;
  amount: number;
  currency: string;
  reference: string;
  status: string;
  nextUrl: string | null;
  returnUrl: string;
  createdAt: string;
  updatedAt: string;
}
