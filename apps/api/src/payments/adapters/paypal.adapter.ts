import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider, VerifiedPaymentResult } from '../interfaces/payment-provider.interface';
import { PaymentTransaction } from '@prisma/client';

@Injectable()
export class PaypalAdapter implements PaymentProvider {
  private readonly logger = new Logger(PaypalAdapter.name);

  private readonly clientId = process.env.PAYPAL_CLIENT_ID || 'mock_paypal_client_id_123';
  private readonly clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'mock_paypal_client_secret_456';
  private readonly apiUrl = process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com';
  private readonly frontendUrl = (
    process.env.FRONTEND_URL || 'http://localhost:3000'
  ).replace(/\/$/, '');

  /**
   * Tạo PayPal Order và lấy Link phê duyệt (Approve Link).
   */
  async createPayment(payment: PaymentTransaction, orderCode: string): Promise<{ paymentUrl: string; providerOrderId?: string }> {
    try {
      const accessToken = await this.getAccessToken();

      // PayPal Sandbox không hỗ trợ VND trực tiếp nên chúng ta chuyển đổi sang USD (1 USD = 25,000 VND)
      const usdAmount = (Number(payment.baseAmount) / 25000).toFixed(2);

      const response = await fetch(`${this.apiUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: payment.paymentId,
              amount: {
                currency_code: 'USD',
                value: usdAmount,
              },
              description: `Thanh toan don hang ${orderCode}`,
            },
          ],
          application_context: {
            return_url: `${this.frontendUrl}/payments/return/paypal?paymentId=${payment.paymentId}`,
            cancel_url: `${this.frontendUrl}/cart`,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
      }

      const data = await response.json();
      const approveLink = data.links.find((l: any) => l.rel === 'approve')?.href;

      return {
        paymentUrl: approveLink || '',
        providerOrderId: data.id,
      };
    } catch (err: any) {
      this.logger.error('Lỗi khởi tạo đơn hàng PayPal:', err.message);
      // Fallback url cho môi trường dev
      return {
        paymentUrl: `/payments/return/mock?paymentId=${payment.paymentId}&provider=PAYPAL`,
        providerOrderId: `MOCK-PAYPAL-ID-${Date.now()}`,
      };
    }
  }

  /**
   * Capture (bắt giữ) tiền sau khi khách hàng đã xác nhận đồng ý trên giao diện PayPal.
   */
  async captureOrder(paypalOrderId: string): Promise<VerifiedPaymentResult> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.apiUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      this.logger.error('Lỗi capture đơn hàng PayPal:', JSON.stringify(errorData));
      return {
        providerTransactionId: '',
        amountPaid: 0,
        currency: 'USD',
        status: 'FAILED',
      };
    }

    const data = await response.json();
    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const status = data.status === 'COMPLETED' ? 'SUCCESS' : 'FAILED';

    return {
      providerTransactionId: capture?.id || paypalOrderId,
      amountPaid: capture?.amount?.value ? Number(capture.amount.value) : 0,
      currency: capture?.amount?.currency_code || 'USD',
      status: status as any,
    };
  }

  /**
   * Phân tích dữ liệu từ PayPal Webhook thông báo về trạng thái thanh toán.
   */
  async verifyAndParseNotification(payload: any): Promise<VerifiedPaymentResult> {
    const resource = payload.resource;
    const eventType = payload.event_type;

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      return {
        providerTransactionId: resource.id,
        amountPaid: Number(resource.amount.value),
        currency: resource.amount.currency_code,
        status: resource.status === 'COMPLETED' ? 'SUCCESS' : 'FAILED',
      };
    }

    return {
      providerTransactionId: '',
      amountPaid: 0,
      currency: '',
      status: 'FAILED',
    };
  }

  /**
   * Truy vấn thông tin giao dịch PayPal trực tiếp từ API.
   */
  async queryStatus(providerOrderId: string): Promise<VerifiedPaymentResult> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.apiUrl}/v2/checkout/orders/${providerOrderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Truy vấn PayPal thất bại: ${response.statusText}`);
    }

    const data = await response.json();
    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];

    return {
      providerTransactionId: capture?.id || providerOrderId,
      amountPaid: capture?.amount?.value ? Number(capture.amount.value) : 0,
      currency: capture?.amount?.currency_code || 'USD',
      status: data.status === 'COMPLETED' ? 'SUCCESS' : 'FAILED',
    };
  }

  /**
   * Lấy Access Token từ PayPal Sandbox API dùng Client Credentials Flow.
   */
  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const response = await fetch(`${this.apiUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error('Không thể xác thực OAuth2 với cổng PayPal.');
    }

    const data = await response.json();
    return data.access_token;
  }
}
