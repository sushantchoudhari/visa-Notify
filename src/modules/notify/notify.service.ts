import { Channel, NotificationStatus } from '@prisma/client';
import { logger } from '../../config/logger';
import { NotFoundError } from '../../shared/errors/AppError';
import { db } from '../../config/db';
import { notifyClient } from './notify.client';
import { notifyRepository } from './notify.repository';

export interface SendEmailOptions {
  applicationId: string;
  templateId: string;
  emailAddress: string;
  personalisation?: Record<string, string | number | boolean>;
  reference?: string;
}

export interface SendSmsOptions {
  applicationId: string;
  templateId: string;
  phoneNumber: string;
  personalisation?: Record<string, string | number | boolean>;
  reference?: string;
}

export const notifyService = {
  async sendEmail(options: SendEmailOptions): Promise<{ notificationId: string }> {
    const application = await db.application.findUnique({ where: { id: options.applicationId } });
    if (!application) throw new NotFoundError('Application', options.applicationId);

    const notification = await notifyRepository.saveNotification({
      application: { connect: { id: options.applicationId } },
      templateId: options.templateId,
      channel: Channel.EMAIL,
      recipient: options.emailAddress,
      status: NotificationStatus.PENDING,
      personalisationJson: options.personalisation ?? {},
    });

    try {
      const response = await notifyClient.sendEmail({
        email_address: options.emailAddress,
        template_id: options.templateId,
        personalisation: options.personalisation,
        reference: options.reference,
      });

      await notifyRepository.updateNotificationStatus(
        notification.id,
        NotificationStatus.SENT,
        response.id,
      );

      logger.info(
        { notificationId: notification.id, notifyId: response.id },
        'Email notification sent',
      );

      return { notificationId: notification.id };
    } catch (err) {
      await notifyRepository.updateNotificationStatus(notification.id, NotificationStatus.FAILED);
      throw err;
    }
  },

  async sendSms(options: SendSmsOptions): Promise<{ notificationId: string }> {
    const application = await db.application.findUnique({ where: { id: options.applicationId } });
    if (!application) throw new NotFoundError('Application', options.applicationId);

    const notification = await notifyRepository.saveNotification({
      application: { connect: { id: options.applicationId } },
      templateId: options.templateId,
      channel: Channel.SMS,
      recipient: options.phoneNumber,
      status: NotificationStatus.PENDING,
      personalisationJson: options.personalisation ?? {},
    });

    try {
      const response = await notifyClient.sendSms({
        phone_number: options.phoneNumber,
        template_id: options.templateId,
        personalisation: options.personalisation,
        reference: options.reference,
      });

      await notifyRepository.updateNotificationStatus(
        notification.id,
        NotificationStatus.SENT,
        response.id,
      );

      logger.info(
        { notificationId: notification.id, notifyId: response.id },
        'SMS notification sent',
      );

      return { notificationId: notification.id };
    } catch (err) {
      await notifyRepository.updateNotificationStatus(notification.id, NotificationStatus.FAILED);
      throw err;
    }
  },
};
