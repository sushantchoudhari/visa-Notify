import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { payWebhookService } from './payWebhook.service';

export const payWebhookRouter = Router();

/**
 * POST /api/v1/pay/webhooks
 *
 * GOV.UK Pay webhook delivery endpoint.
 * - Uses raw body (captured before express.json()) for HMAC verification
 * - Responds with 200 immediately after saving the event
 * - Heavy processing happens asynchronously via DB-backed poller
 */
payWebhookRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    await payWebhookService.handleIncomingWebhook(req);
    res.status(200).json({ received: true });
  }),
);
