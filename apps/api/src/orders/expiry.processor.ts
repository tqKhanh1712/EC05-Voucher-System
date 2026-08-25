import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderExpirationService } from './order-expiration.service';

@Injectable()
export class ExpiryProcessor {
  private readonly logger = new Logger(ExpiryProcessor.name);

  constructor(
    private readonly orderExpirationService: OrderExpirationService,
  ) {}

  /**
   * Bộ quét định kỳ (mỗi 30 giây) để quét và hủy các đơn hàng giữ chỗ hết hạn thanh toán.
   * Giải phóng số lượng tồn kho đã giữ (decrement reservedStock).
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleExpiredReservations() {
    const expiredCount = await this.orderExpirationService.expireDueOrders();
    if (expiredCount > 0) {
      this.logger.log(`Đã xử lý ${expiredCount} đơn hàng quá hạn thanh toán.`);
    }
  }
}
