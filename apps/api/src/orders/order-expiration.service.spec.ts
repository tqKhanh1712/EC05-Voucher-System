import {
  OrderStatus,
  PaymentStatus,
  PaymentTransactionStatus,
  ReservationStatus,
} from '@prisma/client';
import { OrderExpirationService } from './order-expiration.service';

describe('OrderExpirationService', () => {
  const now = new Date('2026-08-25T13:30:00.000Z');
  const orderId = '00000000-0000-4000-8000-000000000021';
  const pendingOrder = {
    orderId,
    orderCode: 'TEST-ORD-EXPIRED',
    orderStatus: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID,
    reservationExpiresAt: new Date('2026-08-25T13:15:00.000Z'),
  };

  function createPrisma(options?: {
    reservations?: Array<Record<string, unknown>>;
    orderResults?: Array<Record<string, unknown>>;
  }) {
    const reservations = options?.reservations ?? [];
    const orderResults = options?.orderResults ?? [pendingOrder];
    const tx = {
      $queryRaw: jest.fn(),
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      inventoryReservation: {
        findMany: jest.fn().mockResolvedValue(reservations),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      voucherCampaign: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      paymentTransaction: {
        updateMany: jest.fn(),
      },
    };
    for (const order of orderResults) {
      tx.order.findUnique.mockResolvedValueOnce(order);
    }

    const prisma = {
      order: { findMany: jest.fn() },
      $transaction: jest.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    return { prisma, tx };
  }

  it('cancels an expired order even when it has no reservation rows', async () => {
    const { prisma, tx } = createPrisma();
    const service = new OrderExpirationService(prisma as any);

    await expect(service.expireOrderIfDue(orderId, now)).resolves.toBe(true);

    expect(tx.inventoryReservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId, status: ReservationStatus.ACTIVE },
      }),
    );
    expect(tx.voucherCampaign.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentTransaction.updateMany).toHaveBeenCalledWith({
      where: {
        orderId,
        status: {
          in: [
            PaymentTransactionStatus.CREATED,
            PaymentTransactionStatus.PENDING,
          ],
        },
      },
      data: { status: PaymentTransactionStatus.EXPIRED },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { orderId },
      data: { orderStatus: OrderStatus.CANCELLED },
    });
  });

  it('releases every active reservation exactly once across repeated calls', async () => {
    const reservations = [
      {
        reservationId: '00000000-0000-4000-8000-000000000031',
        orderId,
        campaignId: '00000000-0000-4000-8000-000000000041',
        quantity: 2,
        status: ReservationStatus.ACTIVE,
      },
      {
        reservationId: '00000000-0000-4000-8000-000000000032',
        orderId,
        campaignId: '00000000-0000-4000-8000-000000000042',
        quantity: 1,
        status: ReservationStatus.ACTIVE,
      },
    ];
    const { prisma, tx } = createPrisma({
      reservations,
      orderResults: [
        pendingOrder,
        { ...pendingOrder, orderStatus: OrderStatus.CANCELLED },
      ],
    });
    const service = new OrderExpirationService(prisma as any);

    await expect(service.expireOrderIfDue(orderId, now)).resolves.toBe(true);
    await expect(service.expireOrderIfDue(orderId, now)).resolves.toBe(false);

    expect(tx.inventoryReservation.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.voucherCampaign.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.order.update).toHaveBeenCalledTimes(1);
  });

  it('does not cancel a pending order before its deadline', async () => {
    const { prisma, tx } = createPrisma({
      orderResults: [
        {
          ...pendingOrder,
          reservationExpiresAt: new Date('2026-08-25T13:45:00.000Z'),
        },
      ],
    });
    const service = new OrderExpirationService(prisma as any);

    await expect(service.expireOrderIfDue(orderId, now)).resolves.toBe(false);

    expect(tx.inventoryReservation.findMany).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('finds due orders from Orders instead of Inventory_Reservations', async () => {
    const { prisma } = createPrisma();
    prisma.order.findMany.mockResolvedValue([{ orderId }]);
    const service = new OrderExpirationService(prisma as any);
    jest.spyOn(service, 'expireOrderIfDue').mockResolvedValue(true);

    await expect(service.expireDueOrders(now)).resolves.toBe(1);

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: {
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        reservationExpiresAt: { lte: now },
      },
      orderBy: { reservationExpiresAt: 'asc' },
      take: 100,
      select: { orderId: true },
    });
  });
});
