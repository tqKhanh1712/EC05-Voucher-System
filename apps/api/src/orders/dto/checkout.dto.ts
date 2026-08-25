import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentProviderType } from '@prisma/client';

export class DirectCheckoutItemDto {
  @IsUUID('4', { message: 'ID chiến dịch voucher không hợp lệ.' })
  campaignId: string;

  @IsInt({ message: 'Số lượng phải là số nguyên.' })
  @Min(1, { message: 'Số lượng mua phải lớn hơn hoặc bằng 1.' })
  @Max(10, { message: 'Bạn chỉ có thể mua tối đa 10 voucher.' })
  quantity: number;
}

export class CheckoutDto {
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự.' })
  @MaxLength(500, { message: 'Ghi chú không được vượt quá 500 ký tự.' })
  recipientNote?: string;

  @IsEnum(PaymentProviderType, {
    message: 'Cổng thanh toán không hợp lệ (STRIPE, PAYPAL, VNPAY).',
  })
  paymentProvider: PaymentProviderType;

  @IsOptional()
  @ValidateNested()
  @Type(() => DirectCheckoutItemDto)
  directItem?: DirectCheckoutItemDto;
}
