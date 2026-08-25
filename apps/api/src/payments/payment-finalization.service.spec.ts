import { BadRequestException } from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
  PaymentTransactionStatus,
  ReservationStatus,
} from '@prisma/client';
import { PaymentFinalizationService } from './payment-finalization.service';

describe('PaymentFinalizationService', () => {
  const paymentId = '00000000-0000-4000-8000-000000000060';
  const orderId = '00000000-0000-4000-8000-000000000061';
  const campaignId = '00000000-0000-4000-8000-000000000062';
  const reservationId = '00000000-0000-4000-8000-000000000063';
  const itemId = '00000000-0000-4000-8000-000000000064';

  function createContext(overrides?: {
    orderStatus?: OrderStatus;
    paymentStatus?: PaymentStatus;
    transactionStatus?: PaymentTransactionStatus;
    reservationStatus?: ReservationStatus;
    omitReservation?: boolean;
    expired?: boolean;
  }) {
    const orderStatus = overrides?.orderStatus ?? OrderStatus.PENDING;
    const paymentStatus = overrides?.paymentStatus ?? PaymentStatus.UNPAID;
    const transactionStatus =
      overrides?.transactionStatus ?? PaymentTransactionStatus.CREATED;
    const reservationStatus =
      overrides?.reservationStatus ?? ReservationStatus.ACTIVE;
    const order = {
      orderId,
      orderCode: 'ORD-PAYMENT-TEST',
      customerId: '00000000-0000-4000-8000-000000000001',
      orderStatus,
      paymentStatus,
      reservationExpiresAt: new Date(
        Date.now() + (overrides?.expired ? -60_000 : 60_000),
      ),
      orderItems: [
        {
          itemId,
          campaignId,
          quantity: 2,
          campaign: { campaignId },
        },
      ],
      inventoryReservations: overrides?.omitReservation
        ? []
        : [
            {
              reservationId,
              campaignId,
              quantity: 2,
              status: reservationStatus,
            },
          ],
    };
    const payment = {
      paymentId,
      orderId,
      status: transactionStatus,
      expiresAt: new Date(Date.now() + (overrides?.expired ? -60_000 : 60_000)),
      order,
    };
    const tx = {
      $executeRawUnsafe: jest.fn(),
      paymentTransaction: {
        findUnique: jest.fn().mockResolvedValue(payment),
        update: jest.fn(),
      },
      order: {
        update: jest.fn().mockResolvedValue({
          ...order,
          orderStatus: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
        }),
      },
      inventoryReservation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      voucherCampaign: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      voucherCode: { create: jest.fn() },
    };
    const prisma = {
      paymentTransaction: {
        findUnique: jest.fn().mockResolvedValue({ orderId }),
      },
      $transaction: jest.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const orderExpirationService = {
      expireOrderIfDue: jest.fn().mockResolvedValue(false),
    };
    return { prisma, tx, orderExpirationService };
  }

  it('rejects a late callback without issuing vouchers or increasing sold stock', async () => {
    const { prisma, tx, orderExpirationService } = createContext({
      orderStatus: OrderStatus.CANCELLED,
      transactionStatus: PaymentTransactionStatus.EXPIRED,
      expired: true,
    });
    const service = new PaymentFinalizationService(
      prisma as any,
      orderExpirationService as any,
    );

    await expect(
      service.finalizePayment(paymentId, 'PROVIDER-LATE'),
    ).rejects.toThrow(BadRequestException);

    expect(orderExpirationService.expireOrderIfDue).toHaveBeenCalledWith(
      orderId,
    );
    expect(tx.paymentTransaction.update).not.toHaveBeenCalled();
    expect(tx.voucherCampaign.updateMany).not.toHaveBeenCalled();
    expect(tx.voucherCode.create).not.toHaveBeenCalled();
  });

  it('rejects inconsistent orders whose active reservation is missing', async () => {
    const { prisma, tx, orderExpirationService } = createContext({
      omitReservation: true,
    });
    const service = new PaymentFinalizationService(
      prisma as any,
      orderExpirationService as any,
    );

    await expect(
      service.finalizePayment(paymentId, 'PROVIDER-MISSING-RESERVATION'),
    ).rejects.toThrow('Phiếu giữ chỗ của đơn hàng không còn hiệu lực.');

    expect(tx.voucherCampaign.updateMany).not.toHaveBeenCalled();
    expect(tx.voucherCode.create).not.toHaveBeenCalled();
  });

  it('commits active reservations and issues vouchers for a valid payment', async () => {
    const { prisma, tx, orderExpirationService } = createContext();
    const service = new PaymentFinalizationService(
      prisma as any,
      orderExpirationService as any,
    );

    await service.finalizePayment(paymentId, 'PROVIDER-SUCCESS');

    expect(tx.inventoryReservation.updateMany).toHaveBeenCalledWith({
      where: {
        reservationId,
        status: ReservationStatus.ACTIVE,
      },
      data: { status: ReservationStatus.COMMITTED },
    });
    expect(tx.voucherCampaign.updateMany).toHaveBeenCalledWith({
      where: {
        campaignId,
        reservedStock: { gte: 2 },
      },
      data: {
        reservedStock: { decrement: 2 },
        soldQuantity: { increment: 2 },
      },
    });
    expect(tx.voucherCode.create).toHaveBeenCalledTimes(2);
  });
});
