import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { notifyCallbackService } from './notifyCallback.service';

export const notifyCallbackRouter = Router();

/**
 * POST /api/v1/notify/callbacks/email
 * Receives GOV.UK Notify delivery status callbacks for email notifications.
 */
notifyCallbackRouter.post(
  '/email',
  asyncHandler(async (req, res) => {
    await notifyCallbackService.handleEmailCallback(req.body);
    res.status(200).json({ received: true });
  }),
);

/**
 * POST /api/v1/notify/callbacks/sms
 * Receives GOV.UK Notify delivery status callbacks for SMS notifications.
 */
notifyCallbackRouter.post(
  '/sms',
  asyncHandler(async (req, res) => {
    await notifyCallbackService.handleSmsCallback(req.body);
    res.status(200).json({ received: true });
  }),
);
