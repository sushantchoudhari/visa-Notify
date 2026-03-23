import { NotificationStatus, Prisma, ProcessingStatus, Provider, WebhookEvent } from '@prisma/client';
import { db } from '../../config/db';
import { logger } from '../../config/logger';
import { notifyDomain } from '../notify/notify.domain';
import { NotifyCallbackPayload } from './notifyCallback.domain';

const BATCH_SIZE = 20;

export const notifyCallbackRepository = {
  async enqueueCallbackEvent(
    externalEventId: string,
    payload: NotifyCallbackPayload,
  ): Promise<WebhookEvent> {
    // Idempotent insert: duplicate callback payload reuses the same externalEventId.
    return db.webhookEvent.upsert({
      where: { externalEventId },
      create: {
        provider: Provider.GOV_NOTIFY,
        externalEventId,
        signatureVerified: true,
        payloadJson: payload as unknown as Prisma.InputJsonValue,
        processingStatus: ProcessingStatus.PENDING,
      },
      update: {},
    });
  },

  async findPendingCallbackEvents(): Promise<WebhookEvent[]> {
    // GOV_NOTIFY scoped queue read keeps payment webhook pipeline isolated.
    return db.webhookEvent.findMany({
      where: {
        provider: Provider.GOV_NOTIFY,
        processingStatus: ProcessingStatus.PENDING,
      },
      orderBy: { receivedAt: 'asc' },
      take: BATCH_SIZE,
    });
  },

  async markCallbackEventProcessing(id: string): Promise<void> {
    await db.webhookEvent.update({
      where: { id },
      data: { processingStatus: ProcessingStatus.PROCESSING },
    });
  },

  async markCallbackEventProcessed(id: string): Promise<void> {
    await db.webhookEvent.update({
      where: { id },
      data: { processingStatus: ProcessingStatus.PROCESSED, processedAt: new Date() },
    });
  },

  async markCallbackEventFailed(id: string, err: unknown): Promise<void> {
    logger.error({ err, callbackEventId: id }, 'Notify callback processing failed and moved to DLQ state');

    await db.webhookEvent.update({
      where: { id },
      data: { processingStatus: ProcessingStatus.FAILED },
    });
  },

  async saveNotificationEvent(
    notifyNotificationId: string,
    eventType: string,
    payload: NotifyCallbackPayload,
  ): Promise<void> {
    const notification = await db.notification.findUnique({
      where: { notifyNotificationId },
    });

    // If local notification is missing we keep processing idempotent and no-op.
    if (!notification) return;

    await db.notificationEvent.create({
      data: {
        notification: { connect: { id: notification.id } },
        eventType,
        payloadJson: payload as unknown as Prisma.InputJsonValue,
      },
    });
  },

  async updateNotificationStatusByNotifyId(
    notifyNotificationId: string,
    govNotifyStatus: string,
    canTransition: (from: NotificationStatus, to: NotificationStatus) => boolean,
  ): Promise<void> {
    const notification = await db.notification.findUnique({
      where: { notifyNotificationId },
    });

    // Unknown notification id is ignored safely to support retries/out-of-order callbacks.
    if (!notification) return;

    const newStatus: NotificationStatus = notifyDomain.mapNotifyStatus(govNotifyStatus);

    // Only apply forward-only valid transitions and never mutate terminal records.
    if (notifyDomain.isTerminal(notification.status) || !canTransition(notification.status, newStatus)) {
      return;
    }

    await db.notification.update({
      where: { id: notification.id },
      data: { status: newStatus },
    });
  },
};
