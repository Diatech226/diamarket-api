import { env } from '../config/env';

export const SHIPPING_STATUSES = ['pending','created','picked_up','in_transit','out_for_delivery','delivered','failed','returned','cancelled'] as const;
export type ShippingStatus = typeof SHIPPING_STATUSES[number];

export const mapDiaExpressStatus = (value: unknown): ShippingStatus => {
  const status = String(value || 'pending').toLowerCase().replace(/[ -]/g, '_');
  if (['created','pending_dispatch','scheduled','confirmed'].includes(status)) return 'created';
  if (['picked_up','collected','pickup_completed'].includes(status)) return 'picked_up';
  if (['in_transit','at_hub','on_the_way'].includes(status)) return 'in_transit';
  if (['out_for_delivery','last_mile'].includes(status)) return 'out_for_delivery';
  if (['delivered','completed'].includes(status)) return 'delivered';
  if (['returned','return_to_sender'].includes(status)) return 'returned';
  if (['cancelled','canceled'].includes(status)) return 'cancelled';
  if (['failed','failed_delivery','exception'].includes(status)) return 'failed';
  return 'pending';
};

export class ShippingProviderError extends Error {
  constructor(message: string, public readonly status = 502) { super(message); }
}

type EstimatePayload = { origin: unknown; destination: unknown; weight: number; dimensions?: unknown; items?: unknown[] };
class DiaExpressService {
  private async request(path: string, init: RequestInit) {
    if (!env.diaexpressApiBaseUrl || !env.diaexpressApiKey) throw new ShippingProviderError('DiaExpress configuration unavailable', 503);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), env.shippingApiTimeout);
    try {
      const response = await fetch(`${env.diaexpressApiBaseUrl.replace(/\/$/, '')}${path}`, { ...init, signal: controller.signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${env.diaexpressApiKey}`, ...(init.headers || {}) } });
      if (response.status === 404) throw new ShippingProviderError('Shipment not found or tracking expired', 404);
      if (!response.ok) throw new ShippingProviderError(`DiaExpress unavailable (${response.status})`);
      return await response.json();
    } catch (error) { if (error instanceof ShippingProviderError) throw error; throw new ShippingProviderError('DiaExpress unavailable'); }
    finally { clearTimeout(timer); }
  }
  async estimateShipping(payload: EstimatePayload) {
    if (env.shippingDemoMode) return { success: true, provider: 'diaexpress', amount: 2500 + Math.round(payload.weight * 400), currency: env.shippingDefaultCurrency, estimatedDeliveryDays: 3, serviceLevel: 'standard', simulated: true };
    const raw = await this.request('/api/quotes/estimate', { method: 'POST', body: JSON.stringify(payload) });
    return { success: true, provider: 'diaexpress', amount: Number(raw.amount ?? raw.estimatedPrice ?? raw.estimatedCost), currency: raw.currency ?? env.shippingDefaultCurrency, estimatedDeliveryDays: Number(raw.estimatedDeliveryDays ?? raw.transitDays ?? 3), serviceLevel: raw.serviceLevel ?? 'standard', simulated: false };
  }
  async createShipment(order: any) {
    if (env.shippingDemoMode) return { providerShipmentId: `DEMO-${order.id}`, trackingNumber: `DX-${order.id}`, status: 'created' as ShippingStatus, estimatedDeliveryDate: new Date(Date.now() + 3*86400000), raw: { simulated: true } };
    const raw = await this.request('/api/shipments', { method: 'POST', body: JSON.stringify({ externalReference: order.id, recipient: order.address, items: order.items, declaredValue: order.totalAmount, currency: order.currency }) });
    return { providerShipmentId: String(raw.shipmentId ?? raw.id), trackingNumber: String(raw.trackingCode ?? raw.trackingNumber), status: mapDiaExpressStatus(raw.status), estimatedDeliveryDate: raw.estimatedDeliveryDate ? new Date(raw.estimatedDeliveryDate) : undefined, raw };
  }
  async getShipmentStatus(trackingNumber: string) { const raw = await this.request(`/api/shipments/tracking/${encodeURIComponent(trackingNumber)}`, { method: 'GET' }); return { status: mapDiaExpressStatus(raw.status), raw }; }
  async cancelShipment(shipmentId: string) { const raw = await this.request(`/api/shipments/${encodeURIComponent(shipmentId)}/cancel`, { method: 'POST' }); return { status: mapDiaExpressStatus(raw.status), raw }; }
}
export const diaexpressService = new DiaExpressService();
