import { z } from 'zod';
import { NotificationStatus } from '@prisma/client';
import { ValidationError } from '../../shared/errors/AppError';

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

type ChannelType = 'email' | 'sms';

type NotificationTransition = `${NotificationStatus}->${NotificationStatus}`;

const VALID_TRANSITIONS = new Set<NotificationTransition>([
  'PENDING->SENT',
  'PENDING->DELIVERED',
  'PENDING->FAILED',
  'PENDING->PERMANENT_FAILURE',
  'PENDING->TECHNICAL_FAILURE',
  'SENT->DELIVERED',
  'SENT->FAILED',
  'SENT->PERMANENT_FAILURE',
  'SENT->TECHNICAL_FAILURE',
  'FAILED->PERMANENT_FAILURE',
  'TECHNICAL_FAILURE->SENT',
  'TECHNICAL_FAILURE->DELIVERED',
  'TECHNICAL_FAILURE->FAILED',
  'TECHNICAL_FAILURE->PERMANENT_FAILURE',
]);

export const notifyCallbackDomain = {
  validatePayload(body: unknown, expectedChannel?: ChannelType): NotifyCallbackPayload {
    const payload = notifyCallbackSchema.parse(body);

    if (expectedChannel && payload.notification_type !== expectedChannel) {
      throw new ValidationError(
        `Notification type mismatch. Expected '${expectedChannel}', got '${payload.notification_type}'`,
      );
    }

    return payload;
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

  buildExternalEventId(payload: NotifyCallbackPayload): string {
    return [
      payload.id,
      payload.notification_type,
      payload.status,
      payload.created_at,
    ].join(':');
  },

  canTransition(from: NotificationStatus, to: NotificationStatus): boolean {
    return VALID_TRANSITIONS.has(`${from}->${to}` as NotificationTransition);
  },
};
