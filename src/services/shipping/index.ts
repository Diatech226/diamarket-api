import { env } from '../../config/env';
import { ExternalShippingProvider } from './providers/external.provider';
import { MockShippingProvider } from './providers/mock.provider';
import { ShippingProvider, ShippingService } from './shipping.service';

const getProvider = (): ShippingProvider => {
  if (env.shippingProvider === 'external') {
    if (!env.shippingApiBaseUrl || !env.shippingApiKey) {
      throw new Error('External shipping provider selected but SHIPPING_API_BASE_URL/SHIPPING_API_KEY are missing');
    }

    return new ExternalShippingProvider({
      baseUrl: env.shippingApiBaseUrl,
      apiKey: env.shippingApiKey,
      timeoutMs: env.shippingApiTimeout,
      originCountry: env.shippingDefaultOriginCountry,
      originCity: env.shippingDefaultOriginCity,
    });
  }

  return new MockShippingProvider();
};

export const shippingService = new ShippingService(getProvider());
export * from './shipping.service';
