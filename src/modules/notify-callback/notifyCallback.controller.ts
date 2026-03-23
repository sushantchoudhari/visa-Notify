import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { notifyCallbackService } from './notifyCallback.service';
import { notifyCallbackAuth } from './notifyCallbackAuth.middleware';

export const notifyCallbackRouter = Router();

// All callback endpoints require a shared bearer token from Notify config.
notifyCallbackRouter.use(notifyCallbackAuth);

/**
 * POST /api/v1/notify/callbacks/email
 * Receives GOV.UK Notify delivery status callbacks for email notifications.
 * The callback is enqueued and acknowledged immediately; async worker handles updates.
 */
notifyCallbackRouter.post(
  '/email',
  asyncHandler(async (req, res) => {
    await notifyCallbackService.enqueueEmailCallback(req.body);
    res.status(200).json({ received: true });
  }),
);

/**
 * POST /api/v1/notify/callbacks/sms
 * Receives GOV.UK Notify delivery status callbacks for SMS notifications.
 * The callback is enqueued and acknowledged immediately; async worker handles updates.
 */
notifyCallbackRouter.post(
  '/sms',
  asyncHandler(async (req, res) => {
    await notifyCallbackService.enqueueSmsCallback(req.body);
    res.status(200).json({ received: true });
  }),
);
