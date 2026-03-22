import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';
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

function buildMockNotificationResponse(
  templateId: string,
  reference?: string,
): SendNotificationResponse {
  const id = `mock_notify_${randomUUID()}`;
  return {
    id,
    reference,
    content: {
      body: 'Mock notification accepted for local testing.',
      subject: 'Mock GOV.UK Notify message',
      from_email: 'mock@gov.test',
      from_number: '+447700900000',
    },
    uri: `/v2/notifications/${id}`,
    template: {
      id: templateId,
      version: 1,
      uri: `/v2/template/${templateId}`,
    },
    scheduled_for: null,
  };
}

export const notifyClient = {
  async sendEmail(payload: SendEmailRequest): Promise<SendNotificationResponse> {
    if (env.USE_MOCK_SERVICES) {
      logger.info({ templateId: payload.template_id }, 'Mock GOV.UK Notify email accepted');
      return buildMockNotificationResponse(payload.template_id, payload.reference);
    }

    const { data } = await client.post<SendNotificationResponse>(
      '/v2/notifications/email',
      payload,
    );
    return data;
  },

  async sendSms(payload: SendSmsRequest): Promise<SendNotificationResponse> {
    if (env.USE_MOCK_SERVICES) {
      logger.info({ templateId: payload.template_id }, 'Mock GOV.UK Notify SMS accepted');
      return buildMockNotificationResponse(payload.template_id, payload.reference);
    }

    const { data } = await client.post<SendNotificationResponse>(
      '/v2/notifications/sms',
      payload,
    );
    return data;
  },
};
