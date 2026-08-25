import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentProviderType,
  PaymentTransactionStatus,
  OrderStatus,
  PaymentStatus,
  UserRole,
} from '@prisma/client';
import { OrderExpirationService } from '../orders/order-expiration.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderExpirationService: OrderExpirationService,
  ) {}

  /**
   * Khởi tạo giao dịch thanh toán mới cho đơn hàng (Payment Attempt).
   * @param customerId ID khách hàng thực hiện thanh toán
   * @param orderId ID đơn hàng cần thanh toán
   * @param provider Loại cổng thanh toán (STRIPE, PAYPAL, VNPAY)
   */
  async createPaymentAttempt(
    customerId: string,
    orderId: string,
    provider: PaymentProviderType,
  ) {
    const ownedOrder = await this.prisma.order.findFirst({
      where: { orderId, customerId },
      select: { orderId: true },
    });

    if (!ownedOrder) {
      throw new NotFoundException('Không tìm thấy đơn hàng yêu cầu.');
    }

    await this.orderExpirationService.expireOrderIfDue(orderId);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT order_id FROM "Orders" WHERE order_id = $1::uuid FOR UPDATE`,
        orderId,
      );

      const order = await tx.order.findFirst({
        where: { orderId, customerId },
        include: { paymentTransactions: true },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng yêu cầu.');
      }

      // Bước 2: Ràng buộc trạng thái đơn hàng (chỉ thanh toán đơn PENDING và UNPAID)
      if (
        order.orderStatus !== OrderStatus.PENDING ||
        order.paymentStatus !== PaymentStatus.UNPAID
      ) {
        throw new BadRequestException(
          'Đơn hàng này không ở trạng thái chờ thanh toán.',
        );
      }

      // Bước 3: Ràng buộc thời gian giữ chỗ tồn kho (RB-15)
      const now = new Date();
      if (order.reservationExpiresAt <= now) {
        throw new BadRequestException(
          'Thời gian giữ chỗ thanh toán của đơn hàng đã hết hạn. Vui lòng đặt lại đơn mới.',
        );
      }

      // Bước 4: Tính số lượt thử thanh toán (attemptNo)
      const attemptNo = order.paymentTransactions.length + 1;
      const idempotencyKey = `IDEM-${order.orderId}-${attemptNo}-${Date.now()}`;

      // Bước 5: Khởi tạo giao dịch thanh toán mới trong DB
      const requestAmountMinor = BigInt(Math.round(Number(order.totalAmount)));

      const payment = await tx.paymentTransaction.create({
        data: {
          orderId: order.orderId,
          provider,
          attemptNo,
          status: PaymentTransactionStatus.CREATED,
          idempotencyKey,
          baseAmount: order.totalAmount,
          requestAmountMinor,
          requestCurrency: 'VND',
          expiresAt: order.reservationExpiresAt,
        },
        include: {
          order: true,
        },
      });

      // Cập nhật cổng thanh toán đang chọn trên đơn hàng
      await tx.order.update({
        where: { orderId: order.orderId },
        data: { selectedPaymentProvider: provider },
      });

      return payment;
    });
  }

  /**
   * Lấy chi tiết trạng thái giao dịch thanh toán để hiển thị giao diện.
   * @param paymentId ID giao dịch thanh toán cục bộ
   */
  async getPaymentDetails(paymentId: string) {
    const payment = await this.prisma.paymentTransaction.findUnique({
      where: { paymentId },
      include: {
        order: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
    }

    return payment;
  }

  async getPaymentDetailsForActor(
    paymentId: string,
    actor: { userId: string; role: UserRole },
  ) {
    const payment = await this.getPaymentDetails(paymentId);
    if (
      actor.role !== UserRole.ADMIN &&
      payment.order.customerId !== actor.userId
    ) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
    }

    return payment;
  }

  async assertPaymentOwner(
    paymentId: string,
    customerId: string,
  ): Promise<void> {
    const payment = await this.prisma.paymentTransaction.findFirst({
      where: { paymentId, order: { customerId } },
      select: { paymentId: true },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
    }
  }

  async assertPaymentPayable(
    paymentId: string,
    customerId: string,
  ): Promise<void> {
    const paymentReference = await this.prisma.paymentTransaction.findFirst({
      where: { paymentId, order: { customerId } },
      select: { orderId: true },
    });

    if (!paymentReference) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
    }

    await this.orderExpirationService.expireOrderIfDue(
      paymentReference.orderId,
    );

    const payment = await this.prisma.paymentTransaction.findFirst({
      where: { paymentId, order: { customerId } },
      include: { order: true },
    });
    const now = new Date();

    if (
      !payment ||
      payment.order.orderStatus !== OrderStatus.PENDING ||
      payment.order.paymentStatus !== PaymentStatus.UNPAID ||
      payment.order.reservationExpiresAt <= now ||
      (payment.expiresAt !== null && payment.expiresAt <= now) ||
      (payment.status !== PaymentTransactionStatus.CREATED &&
        payment.status !== PaymentTransactionStatus.PENDING)
    ) {
      throw new BadRequestException(
        'Đơn hàng đã hết hạn hoặc không còn ở trạng thái chờ thanh toán.',
      );
    }
  }
}
