import { Notification, NotificationStatus, Prisma } from '@prisma/client';
import { db } from '../../config/db';

export const notifyRepository = {
  async saveNotification(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return db.notification.create({ data });
  },

  async findById(id: string): Promise<Notification | null> {
    return db.notification.findUnique({ where: { id } });
  },

  async findByNotifyId(notifyNotificationId: string): Promise<Notification | null> {
    return db.notification.findUnique({ where: { notifyNotificationId } });
  },

  async updateNotificationStatus(
    id: string,
    status: NotificationStatus,
    notifyNotificationId?: string,
  ): Promise<Notification> {
    return db.notification.update({
      where: { id },
      data: { status, ...(notifyNotificationId && { notifyNotificationId }) },
    });
  },

  async saveNotificationEvent(data: Prisma.NotificationEventCreateInput): Promise<void> {
    await db.notificationEvent.create({ data });
  },
};
