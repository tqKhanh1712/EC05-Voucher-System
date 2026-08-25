import { ExpiryProcessor } from './expiry.processor';

describe('ExpiryProcessor', () => {
  it('delegates the periodic sweep to the shared expiration service', async () => {
    const orderExpirationService = {
      expireDueOrders: jest.fn().mockResolvedValue(2),
    };
    const processor = new ExpiryProcessor(orderExpirationService as any);

    await processor.handleExpiredReservations();

    expect(orderExpirationService.expireDueOrders).toHaveBeenCalledTimes(1);
  });
});
