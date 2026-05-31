import { env } from '../../config/env';
import { DiapayProvider } from './providers/diapay.provider';
import { MockPaymentProvider } from './providers/mock.provider';
import { PaymentProvider, PaymentService } from './payment.service';

const getProvider = (): PaymentProvider => {
  if (env.paymentProvider === 'diapay') {
    if (!env.diapayApiBaseUrl || !env.diapayApiKey || !env.diapaySecretKey) {
      throw new Error('Diapay provider selected but DIAPAY_API_BASE_URL/DIAPAY_API_KEY/DIAPAY_SECRET_KEY are missing');
    }

    return new DiapayProvider({
      baseUrl: env.diapayApiBaseUrl,
      apiKey: env.diapayApiKey,
      secretKey: env.diapaySecretKey,
      timeoutMs: env.diapayApiTimeout,
      defaultCurrency: env.paymentDefaultCurrency,
    });
  }

  return new MockPaymentProvider();
};

export const paymentService = new PaymentService(getProvider());
export * from './payment.service';
