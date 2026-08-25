import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpiryProcessor } from './expiry.processor';
import { OrderExpirationService } from './order-expiration.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderExpirationService, ExpiryProcessor],
  exports: [OrdersService, OrderExpirationService],
})
export class OrdersModule {}
