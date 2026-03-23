import { logger } from '../../config/logger';
import { notifyCallbackDomain, NotifyCallbackPayload } from './notifyCallback.domain';
import { notifyCallbackRepository } from './notifyCallback.repository';

export const notifyCallbackService = {
  async enqueueEmailCallback(body: unknown): Promise<void> {
    // 1) Validate shape and ensure this payload matches the email endpoint.
    const payload: NotifyCallbackPayload = notifyCallbackDomain.validatePayload(body, 'email');
    // 2) Build deterministic external event id for idempotent upsert.
    const externalEventId = notifyCallbackDomain.buildExternalEventId(payload);

    // 3) Persist callback event as PENDING in queue table and return 200 to caller.
    await notifyCallbackRepository.enqueueCallbackEvent(externalEventId, payload);
    logger.info({ notifyId: payload.id, externalEventId }, 'Email callback enqueued');
  },

  async enqueueSmsCallback(body: unknown): Promise<void> {
    // 1) Validate shape and ensure this payload matches the sms endpoint.
    const payload: NotifyCallbackPayload = notifyCallbackDomain.validatePayload(body, 'sms');
    // 2) Build deterministic external event id for idempotent upsert.
    const externalEventId = notifyCallbackDomain.buildExternalEventId(payload);

    // 3) Persist callback event as PENDING in queue table and return 200 to caller.
    await notifyCallbackRepository.enqueueCallbackEvent(externalEventId, payload);
    logger.info({ notifyId: payload.id, externalEventId }, 'SMS callback enqueued');
  },

  async processPendingCallbacks(): Promise<void> {
    const events = await notifyCallbackRepository.findPendingCallbackEvents();
    if (events.length === 0) return;

    logger.debug({ count: events.length }, 'Processing pending notify callback events');

    for (const event of events) {
      await notifyCallbackRepository.markCallbackEventProcessing(event.id);
      try {
        // Worker loads queued payload and applies delivery state update rules.
        const payload = event.payloadJson as unknown as NotifyCallbackPayload;
        const eventType = notifyCallbackDomain.getEventType(payload.status);

        await notifyCallbackRepository.saveNotificationEvent(payload.id, eventType, payload);
        await notifyCallbackRepository.updateNotificationStatusByNotifyId(
          payload.id,
          payload.status,
          notifyCallbackDomain.canTransition,
        );

        await notifyCallbackRepository.markCallbackEventProcessed(event.id);

        logger.info(
          { notifyId: payload.id, callbackEventId: event.id, eventType, status: payload.status },
          'Notify callback processed',
        );
      } catch (err) {
        // Failed callbacks are retained with FAILED processing status (DLQ-style retention).
        await notifyCallbackRepository.markCallbackEventFailed(event.id, err);
      }
    }
  },

  startPolling(intervalMs: number): ReturnType<typeof setInterval> {
    return setInterval(() => {
      this.processPendingCallbacks().catch((err) => {
        logger.error({ err }, 'Unhandled error in notify callback poller');
      });
    }, intervalMs);
  },
};
