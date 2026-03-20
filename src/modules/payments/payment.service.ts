import { ApplicationStatus, PaymentStatus, Prisma } from '@prisma/client';
import { db } from '../../config/db';
import { logger } from '../../config/logger';
import { AppError, NotFoundError } from '../../shared/errors/AppError';
import { govPayClient } from './govPay.client';
import { paymentDomain } from './payment.domain';
import { paymentMapper } from './payment.mapper';
import { paymentRepository } from './payment.repository';
import { CreatePaymentRequest, PaymentDto } from './payment.types';

export const paymentService = {
  async createPayment(req: CreatePaymentRequest): Promise<PaymentDto & { govPayNextUrl: string | null }> {
    const application = await db.application.findUnique({ where: { id: req.applicationId } });
    if (!application) {
      throw new NotFoundError('Application', req.applicationId);
    }

    const govPayResponse = await govPayClient.createPayment(
      paymentMapper.toGovPayCreateRequest(
        req.amount,
        req.reference,
        req.description,
        req.returnUrl,
        req.metadata,
      ),
    );

    const payment = await paymentRepository.create({
      application: { connect: { id: req.applicationId } },
      govPayPaymentId: govPayResponse.payment_id,
      amount: req.amount,
      currency: 'GBP',
      reference: req.reference,
      status: PaymentStatus.CREATED,
      nextUrl: paymentMapper.extractNextUrl(govPayResponse),
      returnUrl: req.returnUrl,
    });

    await db.application.update({
      where: { id: req.applicationId },
      data: { status: ApplicationStatus.PAYMENT_CREATED },
    });

    logger.info({ paymentId: payment.id, govPayPaymentId: govPayResponse.payment_id }, 'Payment created');

    return {
      ...paymentMapper.toDto(payment),
      govPayNextUrl: payment.nextUrl,
    };
  },

  async getPaymentStatus(id: string): Promise<PaymentDto> {
    const payment = await paymentRepository.findById(id);
    if (!payment) {
      throw new NotFoundError('Payment', id);
    }
    return paymentMapper.toDto(payment);
  },

  async reconcilePayment(id: string): Promise<PaymentDto> {
    const payment = await paymentRepository.findById(id);
    if (!payment) {
      throw new NotFoundError('Payment', id);
    }

    if (!payment.govPayPaymentId) {
      throw new AppError('Payment has no GOV.UK Pay payment ID', 400, 'NO_GOV_PAY_ID');
    }

    if (paymentDomain.isTerminal(payment.status)) {
      return paymentMapper.toDto(payment);
    }

    const govPayPayment = await govPayClient.getPayment(payment.govPayPaymentId);
    const newStatus = paymentDomain.mapGovPayStatus(govPayPayment.state.status);

    if (!paymentDomain.canTransition(payment.status, newStatus)) {
      logger.warn(
        { paymentId: id, from: payment.status, to: newStatus },
        'Invalid payment status transition — skipping',
      );
      return paymentMapper.toDto(payment);
    }

    const updated = await paymentRepository.updateStatus(id, newStatus);

    await paymentRepository.savePaymentEvent({
      payment: { connect: { id } },
      eventType: 'RECONCILE',
      statusBefore: payment.status,
      statusAfter: newStatus,
      payloadJson: govPayPayment as unknown as Prisma.InputJsonValue,
      processedAt: new Date(),
    });

    logger.info({ paymentId: id, from: payment.status, to: newStatus }, 'Payment reconciled');
    return paymentMapper.toDto(updated);
  },
};
