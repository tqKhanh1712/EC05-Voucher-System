import { BadRequestException } from '@nestjs/common';
import { PaymentProviderType, Prisma, VoucherStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService checkout', () => {
  function createTransaction(campaignOverrides: Record<string, unknown> = {}) {
    const campaign = {
      campaignId: '00000000-0000-4000-8000-000000000010',
      title: 'Voucher test',
      status: VoucherStatus.APPROVED,
      saleStartTime: new Date(Date.now() - 60_000),
      saleEndTime: new Date(Date.now() + 60_000),
      capacity: 100,
      soldQuantity: 5,
      reservedStock: 2,
      originalPrice: new Prisma.Decimal('24.99'),
      salePrice: new Prisma.Decimal('19.99'),
      ...campaignOverrides,
    };
    const item = { campaignId: campaign.campaignId, quantity: 2 };
    const tx = {
      $queryRaw: jest.fn(),
      cartItem: {
        findMany: jest.fn().mockResolvedValue([item]),
        deleteMany: jest.fn(),
      },
      voucherCampaign: {
        findUnique: jest.fn().mockResolvedValue(campaign),
        update: jest.fn(),
      },
      order: {
        create: jest.fn().mockResolvedValue({ orderId: 'order-1' }),
      },
      orderItem: { create: jest.fn() },
      inventoryReservation: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    return { campaign, prisma, tx };
  }

  it('rejects a campaign that is not currently approved for sale', async () => {
    const { prisma, tx } = createTransaction({ status: VoucherStatus.DRAFT });
    const service = new OrdersService(prisma as any);

    await expect(
      service.checkout('00000000-0000-4000-8000-000000000001', {
        paymentProvider: PaymentProviderType.STRIPE,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('uses the locked current price and exact decimal arithmetic', async () => {
    const { campaign, prisma, tx } = createTransaction();
    const service = new OrdersService(prisma as any);

    await service.checkout('00000000-0000-4000-8000-000000000001', {
      paymentProvider: PaymentProviderType.STRIPE,
    });

    const orderData = tx.order.create.mock.calls[0][0].data;
    const itemData = tx.orderItem.create.mock.calls[0][0].data;
    expect(orderData.totalAmount.toString()).toBe('39.98');
    expect(itemData.unitPrice.toString()).toBe(campaign.salePrice.toString());
    expect(tx.cartItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { campaignId: 'asc' } }),
    );
  });

  it('uses original price when a campaign has no discount', async () => {
    const { prisma, tx } = createTransaction({
      originalPrice: new Prisma.Decimal('50.00'),
      salePrice: null,
    });
    const service = new OrdersService(prisma as any);

    await service.checkout('00000000-0000-4000-8000-000000000001', {
      paymentProvider: PaymentProviderType.STRIPE,
    });

    const orderData = tx.order.create.mock.calls[0][0].data;
    const itemData = tx.orderItem.create.mock.calls[0][0].data;
    expect(orderData.totalAmount.toString()).toBe('100');
    expect(itemData.unitPrice.toString()).toBe('50');
  });

  it('checks out only the direct item and preserves the existing cart', async () => {
    const { campaign, prisma, tx } = createTransaction();
    const service = new OrdersService(prisma as any);

    await service.checkout('00000000-0000-4000-8000-000000000001', {
      paymentProvider: PaymentProviderType.STRIPE,
      directItem: {
        campaignId: campaign.campaignId,
        quantity: 3,
      },
    });

    expect(tx.cartItem.findMany).not.toHaveBeenCalled();
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.orderItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: campaign.campaignId,
        quantity: 3,
      }),
    });
    expect(tx.order.create.mock.calls[0][0].data.totalAmount.toString()).toBe(
      '59.97',
    );
  });

  it('clears the cart after the regular cart checkout', async () => {
    const { prisma, tx } = createTransaction();
    const service = new OrdersService(prisma as any);

    await service.checkout('00000000-0000-4000-8000-000000000001', {
      paymentProvider: PaymentProviderType.STRIPE,
    });

    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { customerId: '00000000-0000-4000-8000-000000000001' },
    });
  });

  it('rejects an invalid direct checkout quantity before reserving stock', async () => {
    const { campaign, prisma, tx } = createTransaction();
    const service = new OrdersService(prisma as any);

    await expect(
      service.checkout('00000000-0000-4000-8000-000000000001', {
        paymentProvider: PaymentProviderType.STRIPE,
        directItem: {
          campaignId: campaign.campaignId,
          quantity: 11,
        },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(tx.voucherCampaign.update).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
  });
});
