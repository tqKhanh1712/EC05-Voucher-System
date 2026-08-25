import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderStatus,
  PaymentStatus,
  ReservationStatus,
  PaymentTransactionStatus,
  VoucherCodeStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import { OrderExpirationService } from '../orders/order-expiration.service';

@Injectable()
export class PaymentFinalizationService {
  private readonly logger = new Logger(PaymentFinalizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderExpirationService: OrderExpirationService,
  ) {}

  /**
   * Hoàn tất giao dịch thanh toán và phát hành mã voucher (Idempotent).
   * Sử dụng SELECT FOR UPDATE để khóa dòng đơn hàng và các chiến dịch voucher.
   * @param paymentId ID giao dịch thanh toán cục bộ
   * @param providerTransactionId ID giao dịch từ cổng thanh toán bên thứ ba (Stripe/PayPal/VNPay)
   */
  async finalizePayment(paymentId: string, providerTransactionId: string) {
    const paymentReference = await this.prisma.paymentTransaction.findUnique({
      where: { paymentId },
      select: { orderId: true },
    });

    if (!paymentReference) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
    }

    // Đồng bộ trạng thái hết hạn trước khi xử lý callback từ cổng thanh toán.
    await this.orderExpirationService.expireOrderIfDue(
      paymentReference.orderId,
    );

    return this.prisma.$transaction(async (tx) => {
      // Luôn khóa Order trước Payment để đồng nhất với luồng hết hạn.
      await tx.$executeRawUnsafe(
        `SELECT order_id FROM "Orders" WHERE order_id = $1::uuid FOR UPDATE`,
        paymentReference.orderId,
      );
      await tx.$executeRawUnsafe(
        `SELECT payment_id FROM "Payment_Transactions" WHERE payment_id = $1::uuid FOR UPDATE`,
        paymentId,
      );

      const payment = await tx.paymentTransaction.findUnique({
        where: { paymentId },
        include: {
          order: {
            include: {
              orderItems: {
                include: { campaign: true },
                orderBy: { campaignId: 'asc' },
              },
              inventoryReservations: {
                orderBy: { campaignId: 'asc' },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
      }

      const order = payment.order;

      // Replay protection chỉ hợp lệ khi cả payment và order đã hoàn tất nhất quán.
      if (
        payment.status === PaymentTransactionStatus.SUCCEEDED &&
        order.orderStatus === OrderStatus.CONFIRMED &&
        order.paymentStatus === PaymentStatus.PAID
      ) {
        this.logger.log(
          `Giao dịch thanh toán ${paymentId} đã hoàn tất thành công từ trước.`,
        );
        return order;
      }

      const now = new Date();
      if (
        order.orderStatus !== OrderStatus.PENDING ||
        order.paymentStatus !== PaymentStatus.UNPAID ||
        order.reservationExpiresAt <= now ||
        (payment.expiresAt !== null && payment.expiresAt <= now) ||
        (payment.status !== PaymentTransactionStatus.CREATED &&
          payment.status !== PaymentTransactionStatus.PENDING)
      ) {
        throw new BadRequestException(
          'Đơn hàng đã hết hạn hoặc không còn ở trạng thái chờ thanh toán.',
        );
      }

      await tx.$executeRawUnsafe(
        `SELECT reservation_id FROM "Inventory_Reservations" WHERE order_id = $1::uuid ORDER BY campaign_id FOR UPDATE`,
        order.orderId,
      );

      for (const item of order.orderItems) {
        await tx.$executeRawUnsafe(
          `SELECT campaign_id FROM "Voucher_Campaigns" WHERE campaign_id = $1::uuid FOR UPDATE`,
          item.campaignId,
        );
      }

      const reservationsByCampaign = new Map(
        order.inventoryReservations.map((reservation) => [
          reservation.campaignId,
          reservation,
        ]),
      );

      for (const item of order.orderItems) {
        const reservation = reservationsByCampaign.get(item.campaignId);
        if (
          !reservation ||
          reservation.status !== ReservationStatus.ACTIVE ||
          reservation.quantity !== item.quantity
        ) {
          throw new BadRequestException(
            'Phiếu giữ chỗ của đơn hàng không còn hiệu lực.',
          );
        }
      }

      // Chỉ ghi nhận thanh toán sau khi toàn bộ invariant đã được xác thực.
      await tx.paymentTransaction.update({
        where: { paymentId },
        data: {
          status: PaymentTransactionStatus.SUCCEEDED,
          providerTransactionId,
          paidAt: now,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { orderId: order.orderId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.CONFIRMED,
        },
      });

      for (const item of order.orderItems) {
        const reservation = reservationsByCampaign.get(item.campaignId)!;
        const committed = await tx.inventoryReservation.updateMany({
          where: {
            reservationId: reservation.reservationId,
            status: ReservationStatus.ACTIVE,
          },
          data: { status: ReservationStatus.COMMITTED },
        });

        if (committed.count !== 1) {
          throw new BadRequestException(
            'Phiếu giữ chỗ của đơn hàng vừa thay đổi trạng thái.',
          );
        }

        const stockCommitted = await tx.voucherCampaign.updateMany({
          where: {
            campaignId: item.campaignId,
            reservedStock: { gte: item.quantity },
          },
          data: {
            reservedStock: { decrement: item.quantity },
            soldQuantity: { increment: item.quantity },
          },
        });

        if (stockCommitted.count !== 1) {
          throw new Error(
            `Reserved stock is inconsistent for campaign ${item.campaignId}.`,
          );
        }
      }

      for (const item of order.orderItems) {
        for (let i = 0; i < item.quantity; i++) {
          // Tạo mã ngẫu nhiên cryptographically secure bằng Node.js crypto
          const uniqueCode = crypto
            .randomBytes(6)
            .toString('hex')
            .toUpperCase(); // 12 ký tự hex

          await tx.voucherCode.create({
            data: {
              itemId: item.itemId,
              uniqueCode,
              customerId: order.customerId,
              status: VoucherCodeStatus.AVAILABLE,
              issuedAt: new Date(),
            },
          });
        }
      }

      this.logger.log(
        `Hoàn tất thanh toán đơn hàng ${order.orderCode}. Đã phát hành mã voucher thành công.`,
      );
      return updatedOrder;
    });
  }
}
