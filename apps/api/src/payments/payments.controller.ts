import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentFinalizationService } from './payment-finalization.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, PaymentProviderType } from '@prisma/client';
import { IsEnum } from 'class-validator';

import { VnPayAdapter } from './adapters/vnpay.adapter';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PaypalAdapter } from './adapters/paypal.adapter';

export class CreatePaymentAttemptDto {
  @IsEnum(PaymentProviderType, {
    message: 'Cổng thanh toán không hợp lệ (STRIPE, PAYPAL, VNPAY).',
  })
  provider: PaymentProviderType;
}

/**
 * Controller tiếp nhận REST API điều phối giao dịch thanh toán.
 * POST /payments/:orderId (tạo attempt), POST /payments/:paymentId/mock-success (mô phỏng thanh toán thành công)
 */
@Controller('payments')
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private paymentFinalizationService: PaymentFinalizationService,
    private vnPayAdapter: VnPayAdapter,
    private stripeAdapter: StripeAdapter,
    private paypalAdapter: PaypalAdapter,
  ) {}

  /**
   * Khởi tạo giao dịch thanh toán mới cho đơn hàng.
   * POST /payments/:orderId
   */
  @Post(':orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async createPaymentAttempt(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @Body() dto: CreatePaymentAttemptDto,
  ) {
    const payment = await this.paymentsService.createPaymentAttempt(
      req.user.userId,
      orderId,
      dto.provider,
    );

    let paymentUrl = `/payments/return/mock?paymentId=${payment.paymentId}`;

    if (payment.provider === PaymentProviderType.VNPAY) {
      const res = await this.vnPayAdapter.createPayment(
        payment,
        (payment as any).order.orderCode,
      );
      paymentUrl = res.paymentUrl;
    } else if (payment.provider === PaymentProviderType.STRIPE) {
      const res = await this.stripeAdapter.createPayment(
        payment,
        (payment as any).order.orderCode,
      );
      paymentUrl = res.paymentUrl;
    } else if (payment.provider === PaymentProviderType.PAYPAL) {
      const res = await this.paypalAdapter.createPayment(
        payment,
        (payment as any).order.orderCode,
      );
      paymentUrl = res.paymentUrl;
      if (res.providerOrderId) {
        await this.paymentsService.updateProviderOrderId(
          payment.paymentId,
          res.providerOrderId,
        );
      }
    }

    return {
      paymentId: payment.paymentId,
      provider: payment.provider,
      paymentUrl,
    };
  }

  /**
   * Xem chi tiết trạng thái giao dịch thanh toán.
   * GET /payments/:paymentId/status
   */
  @Get(':paymentId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async getPaymentStatus(
    @Req() req: any,
    @Param('paymentId') paymentId: string,
  ) {
    const payment = await this.paymentsService.getPaymentDetailsForActor(
      paymentId,
      req.user,
    );
    return {
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      status: payment.status,
      paidAt: payment.paidAt,
    };
  }

  /**
   * API Mô phỏng (Developer tool): Giúp kích hoạt thanh toán thành công để kiểm tra tính nhất quán,
   * kiểm tra việc giảm reservedStock, tăng soldQuantity và tự động phát hành Voucher Codes.
   * POST /payments/:paymentId/mock-success
   */
  @Post(':paymentId/mock-success')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async mockSuccess(@Param('paymentId') paymentId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Endpoint mô phỏng bị vô hiệu hóa trong production.',
      );
    }

    const providerTransactionId = `MOCK-TX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const order = await this.paymentFinalizationService.finalizePayment(
      paymentId,
      providerTransactionId,
    );
    return {
      message: 'Mô phỏng thanh toán thành công!',
      orderId: order.orderId,
      orderCode: order.orderCode,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
    };
  }

  /**
   * VNPay IPN (Instant Payment Notification) Callback.
   * Cổng thanh toán gọi API này ẩn dưới nền để đồng bộ trạng thái thanh toán.
   * GET /payments/vnpay/ipn
   */
  @Get('vnpay/ipn')
  async handleVnPayIpn(@Req() req: any) {
    const query = req.query;
    try {
      const result = await this.vnPayAdapter.verifyAndParseNotification(query);
      const paymentId = query.vnp_TxnRef;

      // 1. Kiểm tra tính hợp lệ của chữ ký checksum
      if (
        result.status === 'FAILED' &&
        result.providerTransactionId === 'MOCK-VNP-TX'
      ) {
        return { RspCode: '97', Message: 'Invalid signature' };
      }

      // 2. Tìm chi tiết giao dịch thanh toán
      let payment;
      try {
        payment = await this.paymentsService.getPaymentDetails(paymentId);
      } catch (err) {
        return { RspCode: '01', Message: 'Order not found' };
      }

      // 3. Kiểm tra số tiền khớp với đơn hàng
      const expectedAmount = Number(payment.baseAmount);
      if (result.amountPaid !== expectedAmount) {
        return { RspCode: '04', Message: 'Invalid amount' };
      }

      // 4. Kiểm tra xem giao dịch đã được ghi nhận thành công từ trước chưa
      if (payment.status === 'SUCCEEDED') {
        return { RspCode: '02', Message: 'Order already confirmed' };
      }

      // 5. Xác nhận trạng thái thanh toán từ VNPay (ResponseCode 00 = Thành công)
      if (query.vnp_ResponseCode === '00') {
        await this.paymentFinalizationService.finalizePayment(
          paymentId,
          result.providerTransactionId,
        );
        return { RspCode: '00', Message: 'Confirm Success' };
      } else {
        // Cập nhật trạng thái giao dịch thanh toán cục bộ thành FAILED
        await this.paymentsService.createPaymentAttempt(
          payment.order.customerId,
          payment.orderId,
          PaymentProviderType.VNPAY,
        );
        return { RspCode: '00', Message: 'Confirm Success' };
      }
    } catch (err: any) {
      return { RspCode: '99', Message: err.message || 'Unknown error' };
    }
  }

  /**
   * Stripe Webhook Callback.
   * Tiếp nhận các sự kiện từ Stripe gửi về (bao gồm thành công checkout session).
   * POST /payments/stripe/webhook
   */
  @Post('stripe/webhook')
  async handleStripeWebhook(@Req() req: any) {
    const signature = req.headers['stripe-signature'];
    const webhookSecret =
      process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mock_secret_key';

    let event: any;
    try {
      // Dùng rawBody buffer được giữ lại ở bootstrap
      event = this.stripeAdapter.verifyWebhookEvent(
        req.rawBody,
        signature,
        webhookSecret,
      );
    } catch (err: any) {
      return {
        status: 'error',
        message: `Webhook signature verification failed: ${err.message}`,
      };
    }

    if (event.type === 'checkout.session.completed') {
      const result = await this.stripeAdapter.verifyAndParseNotification(event);
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;

      if (result.status === 'SUCCESS' && paymentId) {
        await this.paymentFinalizationService.finalizePayment(
          paymentId,
          result.providerTransactionId,
        );
      }
    }

    return { received: true };
  }

  /**
   * PayPal Capture Callback.
   * Gọi API này để thực thi capture (bắt tiền) đơn hàng sau khi khách hàng đồng ý.
   * POST /payments/paypal/capture
   */
  @Post('paypal/capture')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async handlePaypalCapture(
    @Req() req: any,
    @Body() dto: { paypalOrderId: string; paymentId: string },
  ) {
    try {
      await this.paymentsService.assertPaymentPayable(
        dto.paymentId,
        req.user.userId,
      );
      const result = await this.paypalAdapter.captureOrder(dto.paypalOrderId);

      if (result.status === 'SUCCESS') {
        const order = await this.paymentFinalizationService.finalizePayment(
          dto.paymentId,
          result.providerTransactionId,
        );
        return {
          success: true,
          message: 'Thanh toán PayPal thành công!',
          orderStatus: order.orderStatus,
        };
      } else {
        return {
          success: false,
          message: 'Không thể xác thực capture tiền từ PayPal Sandbox.',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Lỗi xử lý capture PayPal.',
      };
    }
  }
}
