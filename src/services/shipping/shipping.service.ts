export type ShippingEstimateInput = {
  totalAmount: number;
  totalWeight?: number;
  distanceKm?: number;
};

export type ShipmentCreationInput = {
  orderId: string;
  totalAmount: number;
  estimatedCost: number;
  currency?: string;
  totalWeight?: number;
  customerName?: string;
  customerPhone?: string;
  destinationCity?: string;
  destinationCountry?: string;
};

export type ShipmentStatusResult = {
  providerStatus: string;
  shipmentStatus: 'created' | 'in_transit' | 'delivered' | 'failed';
  orderStatus: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber: string;
  simulated: boolean;
  raw?: any;
};

export type ShippingProvider = {
  name: string;
  estimate: (input: ShippingEstimateInput) => Promise<{ provider: string; estimatedCost: number; estimatedDeliveryDays: number; simulated: boolean }>;
  createShipment: (input: ShipmentCreationInput) => Promise<{ shipmentId: string; status: string; trackingNumber: string; simulated: boolean; raw?: any }>;
  getShipmentStatus: (trackingNumber: string) => Promise<ShipmentStatusResult>;
};

export class ShippingService {
  constructor(private readonly provider: ShippingProvider) {}

  estimateShipping(orderData: ShippingEstimateInput) {
    return this.provider.estimate(orderData);
  }

  createShipment(orderData: ShipmentCreationInput) {
    return this.provider.createShipment(orderData);
  }

  syncShipmentStatus(trackingNumber: string) {
    return this.provider.getShipmentStatus(trackingNumber);
  }
}
