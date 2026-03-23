import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { UnauthorizedError } from '../../shared/errors/AppError';
import { govPayClient } from '../payments/govPay.client';
import { paymentDomain } from '../payments/payment.domain';
import { paymentRepository } from '../payments/payment.repository';
import { GovPayWebhookPayload, payWebhookDomain } from './payWebhook.domain';
import { payWebhookRepository } from './payWebhook.repository';
import { paySignatureService } from './paySignature.service';

export const payWebhookService = {
  async handleIncomingWebhook(req: Request): Promise<void> {
    const signatureHeader = req.headers['pay-signature'] as string | undefined;
    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new UnauthorizedError('Missing raw body for signature verification');
    }

    const signatureVerified =
      !!signatureHeader &&
      paySignatureService.verify(rawBody, signatureHeader, env.GOV_PAY_WEBHOOK_SECRET);

    if (!signatureVerified) {
      logger.warn('GOV.UK Pay webhook received with invalid or missing signature');
      throw new UnauthorizedError('Invalid Pay-Signature header');
    }

    const payload = JSON.parse(rawBody.toString('utf8')) as GovPayWebhookPayload;

    // Extract payment ID from resource_id (official spec)
    const govPayPaymentId = payWebhookDomain.getPaymentId(payload);
    const localPayment = govPayPaymentId
      ? await paymentRepository.findByGovPayId(govPayPaymentId)
      : null;

    const args = payWebhookDomain.buildWebhookEventArgs(
      payload,
      signatureVerified,
      localPayment?.id,
    );

    const event = await payWebhookRepository.saveWebhookEvent(args);
    logger.info(
      { webhookEventId: event.id, paymentId: govPayPaymentId, eventType: payload.event_type },
      'Webhook event saved',
    );
  },

  async processPendingEvents(): Promise<void> {
    const events = await payWebhookRepository.findPendingEvents();
    if (events.length === 0) return;

    logger.debug({ count: events.length }, 'Processing pending webhook events');

    for (const event of events) {
      await payWebhookRepository.markProcessing(event.id);
      try {
        const payload = event.payloadJson as unknown as GovPayWebhookPayload;

        const govPayPaymentId = payWebhookDomain.getPaymentId(payload);
        if (govPayPaymentId) {
          const localPayment = await paymentRepository.findByGovPayId(govPayPaymentId);
          if (localPayment && !paymentDomain.isTerminal(localPayment.status)) {
            const govPayPayment = await govPayClient.getPayment(govPayPaymentId);
            const newStatus = paymentDomain.mapGovPayStatus(govPayPayment.state.status);

            if (paymentDomain.canTransition(localPayment.status, newStatus)) {
              await paymentRepository.updateStatus(localPayment.id, newStatus);
              await paymentRepository.savePaymentEvent({
                payment: { connect: { id: localPayment.id } },
                govPayEventId: event.externalEventId,
                eventType: payload.event_type,
                statusBefore: localPayment.status,
                statusAfter: newStatus,
                payloadJson: payload as unknown as Prisma.InputJsonValue,
                processedAt: new Date(),
              });
              logger.info(
                { paymentId: localPayment.id, from: localPayment.status, to: newStatus },
                'Payment status updated from webhook event',
              );
            }
          }
        }

        await payWebhookRepository.markProcessed(event.id);
      } catch (err) {
        logger.error({ err, webhookEventId: event.id }, 'Failed to process webhook event');
        await payWebhookRepository.markFailed(event.id);
      }
    }
  },

  startPolling(intervalMs: number): ReturnType<typeof setInterval> {
    return setInterval(() => {
      this.processPendingEvents().catch((err) => {
        logger.error({ err }, 'Unhandled error in webhook poller');
      });
    }, intervalMs);
  },
};
