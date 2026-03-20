import axios, { AxiosInstance } from 'axios';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  GovPayPaymentResponse,
  CreateGovPayPaymentRequest,
} from './payment.types';

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
      return Promise.reject(err);
    },
  );

  return client;
}

const client = buildClient();

export const govPayClient = {
  async createPayment(
    payload: CreateGovPayPaymentRequest,
  ): Promise<GovPayPaymentResponse> {
    const { data } = await client.post<GovPayPaymentResponse>('/v1/payments', payload);
    return data;
  },

  async getPayment(paymentId: string): Promise<GovPayPaymentResponse> {
    const { data } = await client.get<GovPayPaymentResponse>(`/v1/payments/${paymentId}`);
    return data;
  },
};
