import { orderToShipmentPayload } from '../mappers/orderToShipmentPayload';
import { shippingResponseMapper } from '../mappers/shippingResponseMapper';
import {
  ShippingEstimateInput,
  ShippingProvider,
  ShipmentCreationInput,
  ShipmentStatusResult,
} from '../shipping.service';

type ExternalProviderConfig = {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  originCountry: string;
  originCity: string;
};

export class ExternalShippingProvider implements ShippingProvider {
  readonly name = 'external';

  constructor(private readonly config: ExternalProviderConfig) {}

  async estimate(input: ShippingEstimateInput) {
    const response = await this.request('/shipping/estimate', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    return {
      provider: this.name,
      estimatedCost: response?.estimatedCost ?? response?.cost ?? 0,
      estimatedDeliveryDays: response?.estimatedDeliveryDays ?? response?.deliveryDays ?? 0,
      simulated: false,
    };
  }

  async createShipment(input: ShipmentCreationInput) {
    const payload = orderToShipmentPayload(input, {
      country: this.config.originCountry,
      city: this.config.originCity,
    });

    const response = await this.request('/shipping/shipments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      shipmentId: response?.id || response?.shipmentId || '',
      status: 'created',
      trackingNumber: response?.tracking_number || response?.trackingNumber || '',
      simulated: false,
      raw: response,
    };
  }

  async getShipmentStatus(trackingNumber: string): Promise<ShipmentStatusResult> {
    const response = await this.request(`/shipping/shipments/${encodeURIComponent(trackingNumber)}`, {
      method: 'GET',
    });

    return shippingResponseMapper(response);
  }

  private async request(path: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          ...(init.headers || {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Shipping API error: ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}
