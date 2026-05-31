export type PaymentMethod = 'bank_transfer' | 'mobile_money' | 'card' | 'crypto' | 'other';

export type PaymentIntentInput = {
  orderId: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, any>;
};

export type PaymentIntentResult = {
  paymentId: string;
  provider: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  redirectUrl?: string;
  clientSecret?: string;
  simulated: boolean;
  raw?: any;
};

export type PaymentStatusResult = {
  paymentId: string;
  providerStatus: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  simulated: boolean;
  raw?: any;
};

export type PaymentProvider = {
  name: string;
  createPaymentIntent: (input: PaymentIntentInput) => Promise<PaymentIntentResult>;
  getPaymentStatus: (paymentId: string) => Promise<PaymentStatusResult>;
};

export class PaymentService {
  constructor(private readonly provider: PaymentProvider) {}

  createIntent(input: PaymentIntentInput) {
    return this.provider.createPaymentIntent(input);
  }

  syncPaymentStatus(paymentId: string) {
    return this.provider.getPaymentStatus(paymentId);
  }
}
