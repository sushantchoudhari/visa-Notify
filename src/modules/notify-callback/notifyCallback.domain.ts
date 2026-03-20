import { z } from 'zod';

export const notifyCallbackSchema = z.object({
  id: z.string(),
  reference: z.string().nullable().optional(),
  to: z.string(),
  status: z.string(),
  created_at: z.string(),
  completed_at: z.string().nullable().optional(),
  sent_at: z.string().nullable().optional(),
  notification_type: z.enum(['email', 'sms', 'letter']),
  template_id: z.string(),
  template_version: z.number().int(),
});

export type NotifyCallbackPayload = z.infer<typeof notifyCallbackSchema>;

export type NotifyCallbackEventType =
  | 'DELIVERED'
  | 'FAILED'
  | 'PERMANENT_FAILURE'
  | 'TECHNICAL_FAILURE'
  | 'TEMPORARY_FAILURE'
  | 'SENT';

export const notifyCallbackDomain = {
  validatePayload(body: unknown): NotifyCallbackPayload {
    return notifyCallbackSchema.parse(body);
  },

  getEventType(status: string): NotifyCallbackEventType {
    const statusMap: Record<string, NotifyCallbackEventType> = {
      delivered: 'DELIVERED',
      'permanent-failure': 'PERMANENT_FAILURE',
      'temporary-failure': 'TEMPORARY_FAILURE',
      'technical-failure': 'TECHNICAL_FAILURE',
      sending: 'SENT',
      created: 'SENT',
      pending: 'SENT',
    };
    return statusMap[status] ?? 'FAILED';
  },
};
