import { PaymentIntentInput, PaymentProvider, PaymentStatusResult } from '../payment.service';

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async createPaymentIntent(input: PaymentIntentInput) {
    return {
      paymentId: `PAY-MOCK-${input.orderId}`,
      provider: this.name,
      status: 'pending' as const,
      redirectUrl: `https://example.com/mock-pay/${encodeURIComponent(input.orderId)}`,
      simulated: true,
      raw: { mock: true, orderId: input.orderId },
    };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    return {
      paymentId,
      providerStatus: 'pending',
      status: 'pending',
      simulated: true,
      raw: { mock: true, paymentId },
    };
  }
}
