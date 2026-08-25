import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
  PaymentTransactionStatus,
  UserRole,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService ownership', () => {
  const payment = {
    paymentId: 'payment-1',
    order: { customerId: 'owner-1' },
  };

  it('hides a payment from another customer', async () => {
    const prisma = {
      paymentTransaction: { findUnique: jest.fn().mockResolvedValue(payment) },
    };
    const service = new PaymentsService(
      prisma as any,
      { expireOrderIfDue: jest.fn() } as any,
    );

    await expect(
      service.getPaymentDetailsForActor(payment.paymentId, {
        userId: 'other-customer',
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows an admin to inspect payment status', async () => {
    const prisma = {
      paymentTransaction: { findUnique: jest.fn().mockResolvedValue(payment) },
    };
    const service = new PaymentsService(
      prisma as any,
      { expireOrderIfDue: jest.fn() } as any,
    );

    await expect(
      service.getPaymentDetailsForActor(payment.paymentId, {
        userId: 'admin-1',
        role: UserRole.ADMIN,
      }),
    ).resolves.toBe(payment);
  });

  it('rejects capture preflight after the order has expired', async () => {
    const orderId = '00000000-0000-4000-8000-000000000071';
    const prisma = {
      paymentTransaction: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ orderId })
          .mockResolvedValueOnce({
            paymentId: payment.paymentId,
            status: PaymentTransactionStatus.EXPIRED,
            expiresAt: new Date(Date.now() - 60_000),
            order: {
              orderId,
              orderStatus: OrderStatus.CANCELLED,
              paymentStatus: PaymentStatus.UNPAID,
              reservationExpiresAt: new Date(Date.now() - 60_000),
            },
          }),
      },
    };
    const orderExpirationService = {
      expireOrderIfDue: jest.fn().mockResolvedValue(true),
    };
    const service = new PaymentsService(
      prisma as any,
      orderExpirationService as any,
    );

    await expect(
      service.assertPaymentPayable(payment.paymentId, 'owner-1'),
    ).rejects.toThrow(BadRequestException);
    expect(orderExpirationService.expireOrderIfDue).toHaveBeenCalledWith(
      orderId,
    );
  });
});
