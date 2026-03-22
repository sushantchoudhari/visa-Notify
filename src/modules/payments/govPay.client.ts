import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../shared/errors/AppError';
import {
  GovPayPaymentResponse,
  CreateGovPayPaymentRequest,
} from './payment.types';

function mapGovPayError(err: unknown): AppError {
  if (!axios.isAxiosError(err)) {
    return new AppError('GOV.UK Pay request failed', 502, 'GOV_PAY_ERROR');
  }

  const status = err.response?.status;

  if (!status) {
    return new AppError(
      'No response from GOV.UK Pay. Please try again.',
      504,
      'GOV_PAY_NO_RESPONSE',
    );
  }

  if (status === 401) {
    return new AppError(
      'GOV.UK Pay authentication failed. Check GOV_PAY_API_KEY.',
      502,
      'GOV_PAY_UNAUTHORIZED',
    );
  }

  if (status === 429) {
    return new AppError(
      'GOV.UK Pay rate limit exceeded. Please retry later.',
      503,
      'GOV_PAY_RATE_LIMIT',
    );
  }

  if (status >= 500) {
    return new AppError(
      'GOV.UK Pay is temporarily unavailable. Please retry later.',
      502,
      'GOV_PAY_UNAVAILABLE',
    );
  }

  return new AppError(
    `GOV.UK Pay request failed with status ${status}`,
    502,
    'GOV_PAY_REQUEST_FAILED',
  );
}

interface MockPaymentStoreRecord {
  payload: CreateGovPayPaymentRequest;
  createdDate: string;
  getCount: number;
}

const mockPaymentStore = new Map<string, MockPaymentStoreRecord>();

function buildMockPaymentResponse(
  paymentId: string,
  status: 'started' | 'success',
  payload: CreateGovPayPaymentRequest,
  createdDate: string,
): GovPayPaymentResponse {
  return {
    payment_id: paymentId,
    amount: payload.amount,
    reference: payload.reference,
    description: payload.description,
    state: {
      status,
      finished: status === 'success',
      ...(status === 'success' ? { message: 'Mock payment succeeded' } : {}),
    },
    return_url: payload.return_url,
    payment_provider: 'mock-gov-pay',
    created_date: createdDate,
    _links: {
      next_url: {
        href: `https://mock.pay.local/checkout/${paymentId}`,
        method: 'GET',
      },
      self: {
        href: `/v1/payments/${paymentId}`,
        method: 'GET',
      },
    },
  };
}

function buildClient(): AxiosInstance {
  const client = axios.create({
    baseURL: env.GOV_PAY_BASE_URL,
    headers: {
      Authorization: `Bearer ${env.GOV_PAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 15_000,
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      logger.error(
        { status: err.response?.status, data: err.response?.data, url: err.config?.url },
        'GOV.UK Pay API error',
      );
      return Promise.reject(mapGovPayError(err));
    },
  );

  return client;
}

const client = buildClient();

export const govPayClient = {
  async createPayment(
    payload: CreateGovPayPaymentRequest,
  ): Promise<GovPayPaymentResponse> {
    if (env.USE_MOCK_SERVICES) {
      const paymentId = `mock_pay_${randomUUID()}`;
      const createdDate = new Date().toISOString();
      mockPaymentStore.set(paymentId, { payload, createdDate, getCount: 0 });
      logger.info({ paymentId }, 'Mock GOV.UK Pay payment created');
      return buildMockPaymentResponse(paymentId, 'started', payload, createdDate);
    }

    const { data } = await client.post<GovPayPaymentResponse>('/v1/payments', payload);
    return data;
  },

  async getPayment(paymentId: string): Promise<GovPayPaymentResponse> {
    if (env.USE_MOCK_SERVICES) {
      const stored = mockPaymentStore.get(paymentId);
      if (!stored) {
        throw new AppError('Mock payment not found', 404, 'MOCK_GOV_PAY_NOT_FOUND');
      }

      stored.getCount += 1;
      const status = stored.getCount >= 2 ? 'success' : 'started';
      logger.info({ paymentId, status, getCount: stored.getCount }, 'Mock GOV.UK Pay payment fetched');
      return buildMockPaymentResponse(paymentId, status, stored.payload, stored.createdDate);
    }

    const { data } = await client.get<GovPayPaymentResponse>(`/v1/payments/${paymentId}`);
    return data;
  },
};
