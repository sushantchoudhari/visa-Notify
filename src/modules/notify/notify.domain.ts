import { NotificationStatus, Channel } from '@prisma/client';

type GovNotifyStatus =
  | 'created'
  | 'sending'
  | 'pending'
  | 'delivered'
  | 'permanent-failure'
  | 'temporary-failure'
  | 'technical-failure';

const GOV_NOTIFY_TO_INTERNAL: Record<GovNotifyStatus, NotificationStatus> = {
  created: NotificationStatus.SENT,
  sending: NotificationStatus.SENT,
  pending: NotificationStatus.SENT,
  delivered: NotificationStatus.DELIVERED,
  'permanent-failure': NotificationStatus.PERMANENT_FAILURE,
  'temporary-failure': NotificationStatus.FAILED,
  'technical-failure': NotificationStatus.TECHNICAL_FAILURE,
};

export const notifyDomain = {
  mapNotifyStatus(govNotifyStatus: string): NotificationStatus {
    const mapped = GOV_NOTIFY_TO_INTERNAL[govNotifyStatus as GovNotifyStatus];
    return mapped ?? NotificationStatus.FAILED;
  },

  isDelivered(status: NotificationStatus): boolean {
    return status === NotificationStatus.DELIVERED;
  },

  isFailed(status: NotificationStatus): boolean {
    const failedStatuses: NotificationStatus[] = [
      NotificationStatus.FAILED,
      NotificationStatus.PERMANENT_FAILURE,
      NotificationStatus.TECHNICAL_FAILURE,
    ];
    return failedStatuses.includes(status);
  },

  isPermanentFailure(status: NotificationStatus): boolean {
    return status === NotificationStatus.PERMANENT_FAILURE;
  },

  isTerminal(status: NotificationStatus): boolean {
    return this.isDelivered(status) || this.isPermanentFailure(status);
  },
};

export { Channel, NotificationStatus };
