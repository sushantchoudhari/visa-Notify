import axios, { AxiosInstance } from 'axios';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export interface SendEmailRequest {
  email_address: string;
  template_id: string;
  personalisation?: Record<string, string | number | boolean>;
  reference?: string;
}

export interface SendSmsRequest {
  phone_number: string;
  template_id: string;
  personalisation?: Record<string, string | number | boolean>;
  reference?: string;
}

export interface SendNotificationResponse {
  id: string;
  reference?: string;
  content: {
    body: string;
    subject?: string;
    from_email?: string;
    from_number?: string;
  };
  uri: string;
  template: {
    id: string;
    version: number;
    uri: string;
  };
  scheduled_for?: string | null;
}

function buildClient(): AxiosInstance {
  const client = axios.create({
    baseURL: env.GOV_NOTIFY_BASE_URL,
    headers: {
      Authorization: `ApiKey-v1 ${env.GOV_NOTIFY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 15_000,
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      logger.error(
        { status: err.response?.status, data: err.response?.data, url: err.config?.url },
        'GOV.UK Notify API error',
      );
      return Promise.reject(err);
    },
  );

  return client;
}

const client = buildClient();

export const notifyClient = {
  async sendEmail(payload: SendEmailRequest): Promise<SendNotificationResponse> {
    const { data } = await client.post<SendNotificationResponse>(
      '/v2/notifications/email',
      payload,
    );
    return data;
  },

  async sendSms(payload: SendSmsRequest): Promise<SendNotificationResponse> {
    const { data } = await client.post<SendNotificationResponse>(
      '/v2/notifications/sms',
      payload,
    );
    return data;
  },
};
