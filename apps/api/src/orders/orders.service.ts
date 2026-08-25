import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutDto } from './dto/checkout.dto';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  ReservationStatus,
  VoucherStatus,
} from '@prisma/client';
import { resolveSellingPrice } from '../common/pricing';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tạo đơn hàng từ giỏ hiện tại hoặc một voucher được mua trực tiếp.
   * Sử dụng khóa dòng SELECT FOR UPDATE (Concurrency Row Locking) để chống bán lố (Oversold).
   * @param customerId ID khách hàng thực hiện thanh toán
   * @param dto DTO chứa thông tin cổng thanh toán và ghi chú
   * @returns Đơn hàng vừa tạo
   */
  async checkout(customerId: string, dto: CheckoutDto) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize checkout attempts for the same customer to prevent duplicate
      // cart or direct orders from racing each other.
      await tx.$queryRaw`
        SELECT user_id FROM "Users"
        WHERE user_id = ${customerId}::uuid
        FOR UPDATE
      `;

      const isDirectCheckout = Boolean(dto.directItem);
      const checkoutItems = dto.directItem
        ? [dto.directItem]
        : await tx.cartItem.findMany({
            where: { customerId },
            orderBy: { campaignId: 'asc' },
          });

      if (checkoutItems.length === 0) {
        throw new BadRequestException('Giỏ hàng của bạn đang trống.');
      }

      for (const item of checkoutItems) {
        if (
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 10
        ) {
          throw new BadRequestException('Số lượng voucher phải từ 1 đến 10.');
        }
      }

      let totalAmount = new Prisma.Decimal(0);
      const currentUnitPrices = new Map<string, Prisma.Decimal>();
      const now = new Date();

      // Lock campaigns in a stable order to avoid deadlocks between checkouts.
      for (const item of checkoutItems) {
        await tx.$queryRaw`
          SELECT campaign_id FROM "Voucher_Campaigns"
          WHERE campaign_id = ${item.campaignId}::uuid
          FOR UPDATE
        `;

        const campaign = await tx.voucherCampaign.findUnique({
          where: { campaignId: item.campaignId },
        });

        if (!campaign) {
          throw new NotFoundException(`Chiến dịch voucher không tồn tại.`);
        }

        if (
          campaign.status !== VoucherStatus.APPROVED ||
          campaign.saleStartTime > now ||
          campaign.saleEndTime <= now
        ) {
          throw new BadRequestException(
            `Voucher "${campaign.title}" hiện không mở bán.`,
          );
        }

        const available =
          campaign.capacity - (campaign.soldQuantity + campaign.reservedStock);
        if (available < item.quantity) {
          throw new BadRequestException(
            `Voucher "${campaign.title}" không đủ số lượng trong kho (Còn lại: ${available}).`,
          );
        }

        const unitPrice = resolveSellingPrice(
          campaign.originalPrice,
          campaign.salePrice,
        );
        currentUnitPrices.set(item.campaignId, unitPrice);
        totalAmount = totalAmount.add(unitPrice.mul(item.quantity));
      }

      for (const item of checkoutItems) {
        await tx.voucherCampaign.update({
          where: { campaignId: item.campaignId },
          data: {
            reservedStock: { increment: item.quantity },
          },
        });
      }

      const orderCode = `ORD-${randomBytes(12).toString('hex').toUpperCase()}`;
      const reservationExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);

      const order = await tx.order.create({
        data: {
          orderCode,
          customerId,
          recipientNote: dto.recipientNote,
          totalAmount,
          selectedPaymentProvider: dto.paymentProvider,
          orderStatus: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          reservationExpiresAt,
        },
      });

      for (const item of checkoutItems) {
        const unitPrice = currentUnitPrices.get(item.campaignId);
        if (!unitPrice) {
          throw new BadRequestException(
            'Không thể xác định giá voucher hiện tại.',
          );
        }

        await tx.orderItem.create({
          data: {
            orderId: order.orderId,
            campaignId: item.campaignId,
            quantity: item.quantity,
            unitPrice,
          },
        });

        await tx.inventoryReservation.create({
          data: {
            orderId: order.orderId,
            campaignId: item.campaignId,
            quantity: item.quantity,
            status: ReservationStatus.ACTIVE,
            expiresAt: reservationExpiresAt,
          },
        });
      }

      if (!isDirectCheckout) {
        await tx.cartItem.deleteMany({
          where: { customerId },
        });
      }

      return order;
    });
  }

  /**
   * Xem danh sách lịch sử đơn hàng của một khách hàng cụ thể.
   * @param customerId ID khách hàng
   */
  async getCustomerOrders(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        orderItems: {
          include: {
            campaign: {
              select: { title: true, category: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Xem chi tiết một đơn hàng của khách hàng.
   * @param customerId ID khách hàng sở hữu
   * @param orderId ID đơn hàng cần xem
   */
  async getOrderDetails(customerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderId, customerId },
      include: {
        orderItems: {
          include: {
            campaign: {
              include: {
                partner: {
                  select: { companyName: true },
                },
              },
            },
          },
        },
        paymentTransactions: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng yêu cầu.');
    }

    return order;
  }

  /**
   * Yêu cầu hoàn tiền và hủy đơn hàng (Refund logic - MVP hỗ trợ hoàn tiền toàn bộ).
   * Ràng buộc: Chỉ hoàn tiền khi toàn bộ mã voucher trong đơn hàng chưa được sử dụng.
   * @param customerId ID khách hàng yêu cầu hoàn tiền
   * @param orderId ID đơn hàng cần hoàn tiền
   */
  async requestRefund(customerId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Tìm đơn hàng và khóa dòng để đảm bảo nhất quán
      await tx.$queryRaw`
        SELECT order_id FROM "Orders"
        WHERE order_id = ${orderId}::uuid
        FOR UPDATE
      `;

      const order = await tx.order.findFirst({
        where: { orderId, customerId },
        include: {
          orderItems: true,
          paymentTransactions: {
            where: { status: 'SUCCEEDED' },
          },
        },
      });

      if (!order) {
        throw new NotFoundException(
          'Không tìm thấy đơn hàng yêu cầu hoàn tiền.',
        );
      }

      // Ràng buộc: Đơn hàng phải đã thanh toán thành công
      if (
        order.paymentStatus !== PaymentStatus.PAID ||
        order.orderStatus !== OrderStatus.CONFIRMED
      ) {
        throw new BadRequestException(
          'Chỉ có thể hoàn tiền cho các đơn hàng đã thanh toán thành công.',
        );
      }

      const payment = order.paymentTransactions[0];
      if (!payment) {
        throw new BadRequestException(
          'Không tìm thấy giao dịch thanh toán thành công liên kết.',
        );
      }

      // 2. Tìm toàn bộ các mã voucher đã phát hành từ đơn hàng này
      const voucherCodes = await tx.voucherCode.findMany({
        where: {
          orderItem: { orderId: order.orderId },
        },
      });

      // Ràng buộc (RB-14): Nếu có bất kỳ mã voucher nào đã dùng (status === USED), từ chối hoàn tiền
      const hasUsedCode = voucherCodes.some((vc) => vc.status === 'USED');
      if (hasUsedCode) {
        throw new BadRequestException(
          'Không thể hoàn tiền vì đã có ít nhất một mã voucher trong đơn hàng đã được sử dụng.',
        );
      }

      // 3. Hủy bỏ tất cả các mã voucher chưa dùng (chuyển sang CANCELLED)
      await tx.voucherCode.updateMany({
        where: {
          orderItem: { orderId: order.orderId },
          status: 'AVAILABLE',
        },
        data: { status: 'CANCELLED' },
      });

      // 4. Khởi tạo bản ghi hoàn tiền PaymentRefund
      await tx.paymentRefund.create({
        data: {
          paymentId: payment.paymentId,
          amountMinor: payment.requestAmountMinor,
          currency: payment.requestCurrency,
          status: 'SUCCEEDED', // Giả lập thành công từ nhà cung cấp
          idempotencyKey: `REFUND-${order.orderId}-${Date.now()}`,
          reason: 'Khách hàng tự hủy và yêu cầu hoàn tiền trực tuyến.',
        },
      });

      // 5. Cập nhật trạng thái đơn hàng thành CANCELLED và trạng thái thanh toán thành REFUNDED
      const updatedOrder = await tx.order.update({
        where: { orderId: order.orderId },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.REFUNDED,
        },
      });

      // 6. Hoàn lại số lượng tồn kho của voucher chiến dịch (giảm soldQuantity)
      for (const item of order.orderItems) {
        await tx.voucherCampaign.update({
          where: { campaignId: item.campaignId },
          data: {
            soldQuantity: { decrement: item.quantity },
          },
        });
      }

      return updatedOrder;
    });
  }

  /**
   * Admin: Xem danh sách toàn bộ đơn hàng trên hệ thống.
   */
  async adminListOrders() {
    return this.prisma.order.findMany({
      include: {
        customer: {
          select: {
            fullName: true,
            email: true,
          },
        },
        orderItems: {
          include: {
            campaign: {
              select: {
                title: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin: Thực hiện hoàn tiền/hủy đơn hàng trực tuyến của hệ thống.
   * Bỏ qua kiểm tra khách hàng sở hữu.
   * @param orderId ID đơn hàng cần hoàn tiền
   */
  async adminRefundOrder(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Khóa dòng
      await tx.$queryRaw`
        SELECT order_id FROM "Orders"
        WHERE order_id = ${orderId}::uuid
        FOR UPDATE
      `;

      const order = await tx.order.findUnique({
        where: { orderId },
        include: {
          orderItems: true,
          paymentTransactions: {
            where: { status: 'SUCCEEDED' },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng cần hủy.');
      }

      if (
        order.paymentStatus !== PaymentStatus.PAID ||
        order.orderStatus !== OrderStatus.CONFIRMED
      ) {
        throw new BadRequestException(
          'Chỉ có thể hoàn tiền cho các đơn hàng đã thanh toán thành công.',
        );
      }

      const payment = order.paymentTransactions[0];
      if (!payment) {
        throw new BadRequestException(
          'Không tìm thấy giao dịch thanh toán thành công liên kết.',
        );
      }

      const voucherCodes = await tx.voucherCode.findMany({
        where: {
          orderItem: { orderId: order.orderId },
        },
      });

      const hasUsedCode = voucherCodes.some((vc) => vc.status === 'USED');
      if (hasUsedCode) {
        throw new BadRequestException(
          'Không thể hoàn tiền vì đã có ít nhất một mã voucher đã được sử dụng.',
        );
      }

      // Hủy mã
      await tx.voucherCode.updateMany({
        where: {
          orderItem: { orderId: order.orderId },
          status: 'AVAILABLE',
        },
        data: { status: 'CANCELLED' },
      });

      // Tạo refund log
      await tx.paymentRefund.create({
        data: {
          paymentId: payment.paymentId,
          amountMinor: payment.requestAmountMinor,
          currency: payment.requestCurrency,
          status: 'SUCCEEDED',
          idempotencyKey: `ADMIN-REFUND-${order.orderId}-${Date.now()}`,
          reason: 'Quản trị viên hệ thống chủ động hủy và hoàn tiền.',
        },
      });

      // Cập nhật trạng thái
      const updatedOrder = await tx.order.update({
        where: { orderId: order.orderId },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.REFUNDED,
        },
      });

      // Trả lại tồn kho
      for (const item of order.orderItems) {
        await tx.voucherCampaign.update({
          where: { campaignId: item.campaignId },
          data: {
            soldQuantity: { decrement: item.quantity },
          },
        });
      }

      return updatedOrder;
    });
  }
}
