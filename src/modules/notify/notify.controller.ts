import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { notifyService } from './notify.service';

export const notifyRouter = Router();

const sendEmailSchema = z.object({
  applicationId: z.string().uuid(),
  templateId: z.string().uuid(),
  emailAddress: z.string().email(),
  personalisation: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  reference: z.string().optional(),
});

const sendSmsSchema = z.object({
  applicationId: z.string().uuid(),
  templateId: z.string().uuid(),
  phoneNumber: z.string().min(10),
  personalisation: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  reference: z.string().optional(),
});

notifyRouter.post(
  '/email',
  asyncHandler(async (req, res) => {
    const body = sendEmailSchema.parse(req.body);
    const result = await notifyService.sendEmail(body);
    res.status(202).json({ data: result });
  }),
);

notifyRouter.post(
  '/sms',
  asyncHandler(async (req, res) => {
    const body = sendSmsSchema.parse(req.body);
    const result = await notifyService.sendSms(body);
    res.status(202).json({ data: result });
  }),
);
