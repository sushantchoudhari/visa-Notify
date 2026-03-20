import { Payment, PaymentStatus, Prisma } from '@prisma/client';
import { db } from '../../config/db';

export const paymentRepository = {
  async create(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return db.payment.create({ data });
  },

  async findById(id: string): Promise<Payment | null> {
    return db.payment.findUnique({ where: { id } });
  },

  async findByGovPayId(govPayPaymentId: string): Promise<Payment | null> {
    return db.payment.findUnique({ where: { govPayPaymentId } });
  },

  async updateStatus(
    id: string,
    status: PaymentStatus,
    nextUrl?: string | null,
  ): Promise<Payment> {
    return db.payment.update({
      where: { id },
      data: { status, ...(nextUrl !== undefined && { nextUrl }) },
    });
  },

  async savePaymentEvent(data: Prisma.PaymentEventCreateInput): Promise<void> {
    await db.paymentEvent.create({ data });
  },
};
