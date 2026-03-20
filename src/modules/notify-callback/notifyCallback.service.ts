import { logger } from '../../config/logger';
import { notifyCallbackDomain, NotifyCallbackPayload } from './notifyCallback.domain';
import { notifyCallbackRepository } from './notifyCallback.repository';

export const notifyCallbackService = {
  async handleEmailCallback(body: unknown): Promise<void> {
    const payload: NotifyCallbackPayload = notifyCallbackDomain.validatePayload(body);
    const eventType = notifyCallbackDomain.getEventType(payload.status);

    await notifyCallbackRepository.upsertNotificationEvent(payload.id, eventType, payload);
    await notifyCallbackRepository.updateNotificationStatusByNotifyId(payload.id, payload.status);

    logger.info(
      { notifyId: payload.id, eventType, status: payload.status },
      'Email callback processed',
    );
  },

  async handleSmsCallback(body: unknown): Promise<void> {
    const payload: NotifyCallbackPayload = notifyCallbackDomain.validatePayload(body);
    const eventType = notifyCallbackDomain.getEventType(payload.status);

    await notifyCallbackRepository.upsertNotificationEvent(payload.id, eventType, payload);
    await notifyCallbackRepository.updateNotificationStatusByNotifyId(payload.id, payload.status);

    logger.info(
      { notifyId: payload.id, eventType, status: payload.status },
      'SMS callback processed',
    );
  },
};
