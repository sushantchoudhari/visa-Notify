import { WebhookEvent, ProcessingStatus, Prisma, Provider } from '@prisma/client';
import { db } from '../../config/db';

const BATCH_SIZE = 20;

export const payWebhookRepository = {
  async saveWebhookEvent(data: Prisma.WebhookEventCreateInput): Promise<WebhookEvent> {
    return db.webhookEvent.upsert({
      where: { externalEventId: data.externalEventId as string },
      create: data,
      update: {}, // idempotent: no-op if already exists
    });
  },

  async findPendingEvents(): Promise<WebhookEvent[]> {
    return db.webhookEvent.findMany({
      where: {
        provider: Provider.GOV_PAY,
        processingStatus: ProcessingStatus.PENDING,
      },
      orderBy: { receivedAt: 'asc' },
      take: BATCH_SIZE,
    });
  },

  async markProcessing(id: string): Promise<void> {
    await db.webhookEvent.update({
      where: { id },
      data: { processingStatus: ProcessingStatus.PROCESSING },
    });
  },

  async markProcessed(id: string): Promise<void> {
    await db.webhookEvent.update({
      where: { id },
      data: { processingStatus: ProcessingStatus.PROCESSED, processedAt: new Date() },
    });
  },

  async markFailed(id: string): Promise<void> {
    await db.webhookEvent.update({
      where: { id },
      data: { processingStatus: ProcessingStatus.FAILED },
    });
  },
};
