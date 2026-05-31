import { orderToPaymentPayload } from '../mappers/orderToPaymentPayload';
import { paymentResponseMapper } from '../mappers/paymentResponseMapper';
import { PaymentIntentInput, PaymentProvider } from '../payment.service';

type DiapayProviderConfig = {
  baseUrl: string;
  apiKey: string;
  secretKey: string;
  timeoutMs: number;
  defaultCurrency: string;
};

export class DiapayProvider implements PaymentProvider {
  readonly name = 'diapay';

  constructor(private readonly config: DiapayProviderConfig) {}

  async createPaymentIntent(input: PaymentIntentInput) {
    const payload = orderToPaymentPayload(input, this.config.defaultCurrency);
    const response = await this.request('/payments/intents', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const mapped = paymentResponseMapper(response);

    return {
      paymentId: mapped.paymentId,
      provider: this.name,
      status: mapped.status,
      redirectUrl: response?.redirect_url || response?.checkout_url,
      clientSecret: response?.client_secret,
      simulated: false,
      raw: response,
    };
  }

  async getPaymentStatus(paymentId: string) {
    const response = await this.request(`/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' });
    return paymentResponseMapper(response);
  }

  private async request(path: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.config.apiKey,
          'X-SECRET-KEY': this.config.secretKey,
          ...(init.headers || {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Diapay API error: ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}
