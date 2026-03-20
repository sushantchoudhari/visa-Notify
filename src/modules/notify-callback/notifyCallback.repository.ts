import { NotificationStatus, Prisma } from '@prisma/client';
import { db } from '../../config/db';
import { notifyDomain } from '../notify/notify.domain';

export const notifyCallbackRepository = {
  async upsertNotificationEvent(
    notifyNotificationId: string,
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    const notification = await db.notification.findUnique({
      where: { notifyNotificationId },
    });

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
  ): Promise<void> {
    const notification = await db.notification.findUnique({
      where: { notifyNotificationId },
    });

    if (!notification) return;

    const newStatus: NotificationStatus = notifyDomain.mapNotifyStatus(govNotifyStatus);

    if (notifyDomain.isTerminal(notification.status)) return;

    await db.notification.update({
      where: { id: notification.id },
      data: { status: newStatus },
    });
  },
};
