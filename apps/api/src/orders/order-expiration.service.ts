import { Injectable, Logger } from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
  PaymentTransactionStatus,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrderExpirationService {
  private readonly logger = new Logger(OrderExpirationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Huỷ một đơn chưa thanh toán đã hết thời gian giữ chỗ.
   * Hàm idempotent: các lần gọi sau không giải phóng tồn kho lần nữa.
   */
  async expireOrderIfDue(orderId: string, now = new Date()): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // Mọi luồng thay đổi trạng thái đơn đều khóa Order trước để tránh race/deadlock.
      await tx.$queryRaw`
        SELECT order_id FROM "Orders"
        WHERE order_id = ${orderId}::uuid
        FOR UPDATE
      `;

      const order = await tx.order.findUnique({
        where: { orderId },
        select: {
          orderId: true,
          orderCode: true,
          orderStatus: true,
          paymentStatus: true,
          reservationExpiresAt: true,
        },
      });

      if (
        !order ||
        order.orderStatus !== OrderStatus.PENDING ||
        order.paymentStatus !== PaymentStatus.UNPAID ||
        order.reservationExpiresAt > now
      ) {
        return false;
      }

      const activeReservations = await tx.inventoryReservation.findMany({
        where: {
          orderId,
          status: ReservationStatus.ACTIVE,
        },
        orderBy: { campaignId: 'asc' },
      });

      for (const reservation of activeReservations) {
        await tx.$queryRaw`
          SELECT reservation_id FROM "Inventory_Reservations"
          WHERE reservation_id = ${reservation.reservationId}::uuid
          FOR UPDATE
        `;
        await tx.$queryRaw`
          SELECT campaign_id FROM "Voucher_Campaigns"
          WHERE campaign_id = ${reservation.campaignId}::uuid
          FOR UPDATE
        `;

        const transition = await tx.inventoryReservation.updateMany({
          where: {
            reservationId: reservation.reservationId,
            status: ReservationStatus.ACTIVE,
          },
          data: { status: ReservationStatus.EXPIRED },
        });

        if (transition.count !== 1) {
          continue;
        }

        const released = await tx.voucherCampaign.updateMany({
          where: {
            campaignId: reservation.campaignId,
            reservedStock: { gte: reservation.quantity },
          },
          data: {
            reservedStock: { decrement: reservation.quantity },
          },
        });

        if (released.count !== 1) {
          throw new Error(
            `Reserved stock is inconsistent for campaign ${reservation.campaignId}.`,
          );
        }
      }

      await tx.paymentTransaction.updateMany({
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

      await tx.order.update({
        where: { orderId },
        data: { orderStatus: OrderStatus.CANCELLED },
      });

      this.logger.log(`Đã hủy đơn hàng quá hạn thanh toán: ${order.orderCode}`);
      return true;
    });
  }

  /**
   * Quét theo thời hạn trên Order, không phụ thuộc việc reservation con có tồn tại.
   */
  async expireDueOrders(now = new Date(), take = 100): Promise<number> {
    const dueOrders = await this.prisma.order.findMany({
      where: {
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        reservationExpiresAt: { lte: now },
      },
      orderBy: { reservationExpiresAt: 'asc' },
      take,
      select: { orderId: true },
    });

    let expiredCount = 0;
    for (const order of dueOrders) {
      try {
        if (await this.expireOrderIfDue(order.orderId, now)) {
          expiredCount += 1;
        }
      } catch (error: unknown) {
        const errorStack = error instanceof Error ? error.stack : String(error);
        this.logger.error(
          `Lỗi khi hủy đơn hàng quá hạn ${order.orderId}:`,
          errorStack,
        );
      }
    }

    return expiredCount;
  }
}
