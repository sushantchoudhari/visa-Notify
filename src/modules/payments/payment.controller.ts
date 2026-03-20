import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../config/db';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { NotFoundError } from '../../shared/errors/AppError';
import { paymentService } from './payment.service';

export const paymentRouter = Router();

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

const createApplicationSchema = z.object({
  applicantRef: z.string().min(1),
});

paymentRouter.post(
  '/applications',
  asyncHandler(async (req, res) => {
    const body = createApplicationSchema.parse(req.body);
    const application = await db.application.create({
      data: { applicantRef: body.applicantRef },
    });
    res.status(201).json({ data: application });
  }),
);

paymentRouter.get(
  '/applications/:id',
  asyncHandler(async (req, res) => {
    const id = req.params['id'] as string;
    const application = await db.application.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!application) throw new NotFoundError('Application', id);
    res.json({ data: application });
  }),
);

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

const createPaymentSchema = z.object({
  applicationId: z.string().uuid(),
  amount: z.number().int().positive(),
  reference: z.string().min(1).max(255),
  description: z.string().min(1).max(255),
  returnUrl: z.string().url(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

paymentRouter.post(
  '/payments',
  asyncHandler(async (req, res) => {
    const body = createPaymentSchema.parse(req.body);
    const result = await paymentService.createPayment(body);
    res.status(201).json({ data: result });
  }),
);

paymentRouter.get(
  '/payments/:id',
  asyncHandler(async (req, res) => {
    const payment = await paymentService.getPaymentStatus(req.params['id'] as string);
    res.json({ data: payment });
  }),
);

paymentRouter.get(
  '/payments/:id/status',
  asyncHandler(async (req, res) => {
    const payment = await paymentService.reconcilePayment(req.params['id'] as string);
    res.json({ data: payment });
  }),
);
