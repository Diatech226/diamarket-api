import { ShippingEstimateInput, ShippingProvider, ShipmentCreationInput, ShipmentStatusResult } from '../shipping.service';

export class MockShippingProvider implements ShippingProvider {
  readonly name = 'mock';

  async estimate(input: ShippingEstimateInput) {
    const base = 2500;
    const weightCost = (input.totalWeight || 1) * 400;
    const distanceCost = ((input.distanceKm || 20) / 10) * 300;

    return {
      provider: this.name,
      estimatedCost: Math.round(base + weightCost + distanceCost),
      estimatedDeliveryDays: 2,
      simulated: true,
    };
  }

  async createShipment(input: ShipmentCreationInput) {
    return {
      shipmentId: `SIM-${input.orderId}`,
      status: 'created',
      trackingNumber: `TRK-${Date.now()}`,
      simulated: true,
      raw: {
        mock: true,
        orderId: input.orderId,
      },
    };
  }

  async getShipmentStatus(trackingNumber: string): Promise<ShipmentStatusResult> {
    return {
      providerStatus: 'in_transit',
      shipmentStatus: 'in_transit',
      orderStatus: 'shipped',
      trackingNumber,
      simulated: true,
      raw: {
        mock: true,
        trackingNumber,
      },
    };
  }
}
